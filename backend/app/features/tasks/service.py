from uuid import UUID

from fastapi import HTTPException, status

from app.features.tasks.repository import TaskRepository
from app.features.tasks.schemas import CreateTaskDTO, UpdateTaskDTO
from app.features.lists.repository import ListRepository
from app.features.projects.repository import ProjectRepository
from app.features.workspaces.repository import WorkspaceRepository
from app.features.audit.repository import AuditRepository
from app.models.task import Task, Priority


class TaskService:
    def __init__(
        self,
        repo: TaskRepository,
        list_repo: ListRepository,
        project_repo: ProjectRepository,
        workspace_repo: WorkspaceRepository,
        audit_repo: AuditRepository,
    ):
        self.repo = repo
        self.list_repo = list_repo
        self.project_repo = project_repo
        self.workspace_repo = workspace_repo
        self.audit_repo = audit_repo

    async def create(self, dto: CreateTaskDTO) -> Task:
        await self._require_workspace_member(dto.workspace_id, dto.reporter_id)
        order_index = await self.repo.get_max_order_index(dto.list_id) + 100.0
        task = await self.repo.create(dto, order_index=order_index)
        await self.audit_repo.log(task.id, actor_id=dto.reporter_id, action="created")
        return task

    async def create_subtask(self, parent_task_id: UUID, body, actor_id: UUID) -> Task:
        parent = await self.get_or_404(parent_task_id)
        await self._require_workspace_member(parent.workspace_id, actor_id)
        order_index = await self.repo.get_max_order_index(parent.list_id) + 100.0
        dto = body.to_dto(
            list_id=parent.list_id,
            workspace_id=parent.workspace_id,
            project_id=parent.project_id,
            reporter_id=actor_id,
            parent_task_id=parent_task_id,
        )
        task = await self.repo.create(dto, order_index=order_index)
        await self.audit_repo.log(task.id, actor_id=actor_id, action="created")
        return task

    async def get_or_404(self, task_id: UUID) -> Task:
        task = await self.repo.get_by_id(task_id)
        if not task:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
        return task

    async def list_for_list(
        self,
        list_id: UUID,
        user_id: UUID,
        status_id: UUID | None = None,
        priority: Priority | None = None,
        assignee_id: UUID | None = None,
    ) -> list[Task]:
        list_ = await self.list_repo.get_by_id(list_id)
        if not list_:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="List not found")
        project = await self.project_repo.get_by_id(list_.project_id)
        await self._require_workspace_member(project.workspace_id, user_id)
        return await self.repo.list_for_list(list_id, status_id, priority, assignee_id)

    async def list_subtasks(self, parent_task_id: UUID, user_id: UUID) -> list[Task]:
        parent = await self.get_or_404(parent_task_id)
        await self._require_workspace_member(parent.workspace_id, user_id)
        return await self.repo.list_subtasks(parent_task_id)

    async def update(self, task_id: UUID, dto: UpdateTaskDTO, actor_id: UUID) -> Task:
        task = await self.get_or_404(task_id)
        await self._require_workspace_member(task.workspace_id, actor_id)
        changes = _diff(task, dto)
        updated = await self.repo.update(task, dto)
        if changes:
            await self.audit_repo.log(task_id, actor_id=actor_id, action="updated", changes=changes)
        return updated

    async def delete(self, task_id: UUID, actor_id: UUID) -> None:
        task = await self.get_or_404(task_id)
        await self._require_workspace_member(task.workspace_id, actor_id)
        await self.repo.soft_delete(task)
        await self.audit_repo.log(task_id, actor_id=actor_id, action="deleted")

    async def _require_workspace_member(self, workspace_id: UUID, user_id: UUID) -> None:
        member = await self.workspace_repo.get_member(workspace_id, user_id)
        if not member:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a workspace member")


def _diff(task: Task, dto: UpdateTaskDTO) -> dict:
    """Return {field: [old, new]} for changed fields."""
    changes = {}
    fields = ["title", "description", "priority", "status_id", "reviewer_id", "due_date"]
    for field in fields:
        new_val = getattr(dto, field)
        if new_val is not None:
            old_val = getattr(task, field)
            # Use .value for enums to get the string representation
            old_str = old_val.value if hasattr(old_val, "value") else (str(old_val) if old_val is not None else None)
            new_str = new_val.value if hasattr(new_val, "value") else str(new_val)
            if old_str != new_str:
                changes[field] = [old_str, new_str]
    if dto.assignee_ids is not None:
        old_ids = [str(i) for i in task.assignee_ids]
        new_ids = [str(i) for i in dto.assignee_ids]
        if old_ids != new_ids:
            changes["assignee_ids"] = [old_ids, new_ids]
    return changes
