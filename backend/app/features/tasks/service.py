from uuid import UUID

from fastapi import HTTPException, status

from app.features.tasks.repository import TaskRepository
from app.features.tasks.schemas import CreateTaskDTO, UpdateTaskDTO
from app.features.lists.repository import ListRepository
from app.features.projects.repository import ProjectRepository
from app.features.workspaces.repository import WorkspaceRepository
from app.features.audit.repository import AuditRepository
from app.features.automations.repository import AutomationRepository
from app.features.teams.repository import TeamRepository
from app.features.status_mappings.repository import StatusMappingRepository
from app.models.automation import ActionType, TriggerType
from app.models.task import Task, Priority
from app.models.workspace import WorkspaceRole


class TaskService:
    def __init__(
        self,
        repo: TaskRepository,
        list_repo: ListRepository,
        project_repo: ProjectRepository,
        workspace_repo: WorkspaceRepository,
        audit_repo: AuditRepository,
        automation_repo: AutomationRepository | None = None,
        team_repo: TeamRepository | None = None,
        status_mapping_repo: StatusMappingRepository | None = None,
    ):
        self.repo = repo
        self.list_repo = list_repo
        self.project_repo = project_repo
        self.workspace_repo = workspace_repo
        self.audit_repo = audit_repo
        self.automation_repo = automation_repo
        self.team_repo = team_repo
        self.status_mapping_repo = status_mapping_repo

    async def create(self, dto: CreateTaskDTO) -> Task:
        await self._require_workspace_member(dto.workspace_id, dto.reporter_id)
        task_number, task_prefix = await self.project_repo.claim_task_number(dto.project_id)
        task_key = f"{task_prefix}-{task_number:05d}"
        order_index = await self.repo.get_max_order_index(dto.list_id) + 100.0
        task = await self.repo.create(dto, order_index=order_index, task_number=task_number, task_key=task_key)
        await self.audit_repo.log(task.id, actor_id=dto.reporter_id, action="created")
        return task

    async def create_subtask(self, parent_task_id: UUID, body, actor_id: UUID) -> Task:
        parent = await self.get_or_404(parent_task_id)
        if parent.depth > 0:
            raise HTTPException(status_code=400, detail="Subtasks cannot have subtasks")
        await self._require_workspace_member(parent.workspace_id, actor_id)

        # Resolve which list the subtask belongs to
        if body.list_id and body.list_id != parent.list_id:
            target_list = await self.list_repo.get_by_id(body.list_id)
            if not target_list or target_list.project_id != parent.project_id:
                raise HTTPException(status_code=400, detail="List does not belong to the same project")
            subtask_list_id = body.list_id
        else:
            subtask_list_id = parent.list_id

        task_number, task_prefix = await self.project_repo.claim_task_number(parent.project_id)
        task_key = f"{task_prefix}-{task_number:05d}"
        order_index = await self.repo.get_max_order_index(subtask_list_id) + 100.0
        dto = body.to_dto(
            list_id=subtask_list_id,
            workspace_id=parent.workspace_id,
            project_id=parent.project_id,
            reporter_id=actor_id,
            parent_task_id=parent_task_id,
        )
        task = await self.repo.create(dto, order_index=order_index, task_number=task_number, task_key=task_key)
        await self.audit_repo.log(task.id, actor_id=actor_id, action="created")
        return task

    async def get_or_404(self, task_id: UUID) -> Task:
        task = await self.repo.get_by_id(task_id)
        if not task:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
        return task

    async def get_or_404_for_user(self, task_id: UUID, user_id: UUID) -> Task:
        """Fetch task and enforce workspace membership + list visibility."""
        task = await self.get_or_404(task_id)
        ws_member = await self.workspace_repo.get_member(task.workspace_id, user_id)
        if not ws_member:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a workspace member")
        # Owners and admins can see all lists
        if ws_member.role in {WorkspaceRole.owner, WorkspaceRole.admin}:
            return task
        # Check list visibility (team restriction)
        if task.list_id and self.team_repo is not None:
            list_ = await self.list_repo.get_by_id(task.list_id)
            if list_ and list_.team_ids:
                user_team_ids = set(
                    await self.team_repo.get_user_team_ids(task.workspace_id, user_id)
                )
                if not (user_team_ids & set(list_.team_ids)):
                    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to view this task")
        return task

    async def list_for_list(
        self,
        list_id: UUID,
        user_id: UUID,
        status_id: UUID | None = None,
        status_ids_not: list[UUID] | None = None,
        priority: Priority | None = None,
        priorities_not: list[Priority] | None = None,
        assignee_id: UUID | None = None,
        cf_filters: dict[UUID, str] | None = None,
        include_subtasks: bool = False,
        page: int = 1,
        page_size: int = 0,
        sort_by: str | None = None,
        sort_dir: str | None = None,
    ) -> tuple[list[Task], int]:
        list_ = await self.list_repo.get_by_id(list_id)
        if not list_:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="List not found")
        project = await self.project_repo.get_by_id(list_.project_id)
        await self._require_workspace_member(project.workspace_id, user_id)
        return await self.repo.list_for_list(list_id, status_id, status_ids_not, priority, priorities_not, assignee_id, cf_filters, include_subtasks, page, page_size, sort_by, sort_dir)

    async def list_for_project(
        self,
        project_id: UUID,
        user_id: UUID,
        list_id: UUID | None = None,
        priority: Priority | None = None,
        priorities_not: list[Priority] | None = None,
        assignee_id: UUID | None = None,
        include_subtasks: bool = False,
        page: int = 1,
        page_size: int = 0,
        sort_by: str | None = None,
        sort_dir: str | None = None,
    ) -> tuple[list[Task], int]:
        project = await self.project_repo.get_by_id(project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        ws_member = await self.workspace_repo.get_member(project.workspace_id, user_id)
        if not ws_member:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a workspace member")

        # Compute which lists the user can see (mirrors ListService.list_for_project)
        list_ids_allowed: list[UUID] | None = None
        if ws_member.role not in {WorkspaceRole.owner, WorkspaceRole.admin}:
            all_lists = await self.list_repo.list_for_project(project_id)
            user_team_ids: set[UUID] = set()
            if self.team_repo is not None:
                user_team_ids = set(
                    await self.team_repo.get_user_team_ids(project.workspace_id, user_id)
                )
            list_ids_allowed = [
                l.id for l in all_lists
                if not l.team_ids or (user_team_ids & set(l.team_ids))
            ]

        return await self.repo.list_for_project(
            project_id, list_ids_allowed, list_id, priority, priorities_not, assignee_id, include_subtasks, page, page_size, sort_by, sort_dir
        )

    async def list_subtasks(self, parent_task_id: UUID, user_id: UUID) -> list[Task]:
        parent = await self.get_or_404(parent_task_id)
        await self._require_workspace_member(parent.workspace_id, user_id)
        return await self.repo.list_subtasks(parent_task_id)

    async def update(self, task_id: UUID, dto: UpdateTaskDTO, actor_id: UUID) -> Task:
        task = await self.get_or_404(task_id)
        await self._require_workspace_member(task.workspace_id, actor_id)
        raw_changes = _diff(task, dto)  # preserves status_id key for automation matching
        # Resolve status UUIDs to human-readable names in the audit log
        audit_changes = dict(raw_changes)
        if "status_id" in audit_changes:
            old_id, new_id = audit_changes["status_id"]
            async def _status_name(sid: str | None) -> str | None:
                if not sid:
                    return None
                from uuid import UUID as _UUID
                s = await self.list_repo.get_status_by_id(_UUID(sid))
                return s.name if s else sid
            audit_changes["status"] = [
                await _status_name(old_id),
                await _status_name(new_id),
            ]
            del audit_changes["status_id"]
        updated = await self.repo.update(task, dto)
        if audit_changes:
            await self.audit_repo.log(task_id, actor_id=actor_id, action="updated", changes=audit_changes)
        if raw_changes and self.automation_repo:
            await self._run_automations(updated, raw_changes)
        return updated

    async def _run_automations(self, task: Task, raw_changes: dict) -> None:
        automations = await self.automation_repo.list_for_list(task.list_id)
        for auto in automations:
            triggered = False
            if auto.trigger_type == TriggerType.status_changed.value:
                if "status_id" in raw_changes and raw_changes["status_id"][1] == auto.trigger_value:
                    triggered = True
            elif auto.trigger_type == TriggerType.priority_changed.value:
                if "priority" in raw_changes and raw_changes["priority"][1] == auto.trigger_value:
                    triggered = True

            if not triggered:
                continue

            # Build a minimal UpdateTaskDTO for the action
            action_dto: UpdateTaskDTO | None = None
            if auto.action_type == ActionType.set_status.value:
                from uuid import UUID as _UUID
                action_dto = UpdateTaskDTO(status_id=_UUID(auto.action_value))
            elif auto.action_type == ActionType.set_priority.value:
                action_dto = UpdateTaskDTO(priority=Priority(auto.action_value))
            elif auto.action_type == ActionType.assign_reviewer.value:
                from uuid import UUID as _UUID
                action_dto = UpdateTaskDTO(reviewer_id=_UUID(auto.action_value))
            elif auto.action_type == ActionType.clear_assignees.value:
                action_dto = UpdateTaskDTO(assignee_ids=())

            if action_dto:
                await self.repo.update(task, action_dto)
                await self.audit_repo.log(
                    task.id,
                    actor_id=auto.created_by,
                    action="automation",
                    changes={"automation_id": str(auto.id), "action_type": auto.action_type},
                )

    async def promote(self, task_id: UUID, actor_id: UUID) -> Task:
        task = await self.get_or_404(task_id)
        if not task.parent_task_id:
            from fastapi import HTTPException
            raise HTTPException(status_code=400, detail="Task is already a top-level task")
        await self._require_workspace_member(task.workspace_id, actor_id)
        promoted = await self.repo.promote(task)
        await self.audit_repo.log(task_id, actor_id=actor_id, action="promoted")
        return promoted

    async def _resolve_status_after_move(
        self, old_list_id: UUID | None, old_status_id: UUID | None, to_list_id: UUID
    ) -> UUID | None:
        """Resolve what status to assign after moving a task to a new list.

        Priority:
        1. Explicit status mapping rule (from_list + from_status → to_status)
        2. Status in destination list whose name matches the old status name
        3. None (clear status)
        """
        if not old_list_id or not old_status_id:
            return None
        # 1. Check explicit mapping
        if self.status_mapping_repo:
            mapping = await self.status_mapping_repo.get_mapping(old_list_id, to_list_id, old_status_id)
            if mapping:
                return mapping.to_status_id
        # 2. Match by name in destination list
        old_status = await self.list_repo.get_status_by_id(old_status_id)
        if old_status:
            dest_statuses = await self.list_repo.list_statuses(to_list_id)
            for s in dest_statuses:
                if s.name.strip().lower() == old_status.name.strip().lower():
                    return s.id
        # 3. Clear
        return None

    async def move(self, task_id: UUID, list_id: UUID, actor_id: UUID) -> Task:
        task = await self.get_or_404(task_id)
        await self._require_workspace_member(task.workspace_id, actor_id)
        list_ = await self.list_repo.get_by_id(list_id)
        if not list_:
            raise HTTPException(status_code=404, detail="List not found")
        project = await self.project_repo.get_by_id(list_.project_id)
        old_list_id = task.list_id
        old_status_id = task.status_id
        task.list_id = list_id
        task.project_id = project.id
        task.workspace_id = project.workspace_id
        task.status_id = await self._resolve_status_after_move(old_list_id, old_status_id, list_id)
        await self.repo.session.flush()
        await self.audit_repo.log(task_id, actor_id=actor_id, action="moved", changes={"list_id": [str(old_list_id), str(list_id)]})
        return task

    async def delete(self, task_id: UUID, actor_id: UUID) -> None:
        task = await self.get_or_404(task_id)
        await self._require_workspace_member(task.workspace_id, actor_id)
        await self.repo.soft_delete(task)
        await self.audit_repo.log(task_id, actor_id=actor_id, action="deleted")

    async def list_my_tasks(
        self,
        workspace_id: UUID,
        user_id: UUID,
        status_id: UUID | None = None,
        priority: Priority | None = None,
    ) -> list[Task]:
        await self._require_workspace_member(workspace_id, user_id)
        return await self.repo.list_my_tasks(workspace_id, user_id, status_id, priority)

    async def search(self, workspace_id: UUID, q: str, actor_id: UUID) -> list[Task]:
        await self._require_workspace_member(workspace_id, actor_id)
        return await self.repo.search(workspace_id, q)

    async def bulk_update(self, task_ids: list[UUID], status_id: UUID | None, priority: str | None, actor_id: UUID, set_epic: bool = False, epic_id: UUID | None = None) -> int:
        if not task_ids:
            raise HTTPException(422, "task_ids cannot be empty")
        task = await self.repo.get_by_id(task_ids[0])
        if not task:
            raise HTTPException(404, "Task not found")
        await self._require_workspace_member(task.workspace_id, actor_id)
        return await self.repo.bulk_update(task_ids, status_id, priority, set_epic=set_epic, epic_id=epic_id)

    async def bulk_move(self, task_ids: list[UUID], list_id: UUID, actor_id: UUID) -> int:
        if not task_ids:
            raise HTTPException(422, "task_ids cannot be empty")
        task = await self.repo.get_by_id(task_ids[0])
        if not task:
            raise HTTPException(404, "Task not found")
        await self._require_workspace_member(task.workspace_id, actor_id)
        list_ = await self.list_repo.get_by_id(list_id)
        if not list_:
            raise HTTPException(404, "List not found")
        project = await self.project_repo.get_by_id(list_.project_id)
        count = 0
        for tid in task_ids:
            t = await self.repo.get_by_id(tid)
            if not t:
                continue
            old_list_id = t.list_id
            old_status_id = t.status_id
            t.list_id = list_id
            t.project_id = project.id
            t.workspace_id = project.workspace_id
            t.status_id = await self._resolve_status_after_move(old_list_id, old_status_id, list_id)
            await self.repo.session.flush()
            await self.audit_repo.log(tid, actor_id=actor_id, action="moved", changes={"list_id": [str(old_list_id), str(list_id)]})
            count += 1
        return count

    async def bulk_delete(self, task_ids: list[UUID], actor_id: UUID) -> int:
        if not task_ids:
            raise HTTPException(422, "task_ids cannot be empty")
        task = await self.repo.get_by_id(task_ids[0])
        if not task:
            raise HTTPException(404, "Task not found")
        await self._require_workspace_member(task.workspace_id, actor_id)
        return await self.repo.bulk_soft_delete(task_ids)

    async def _require_workspace_member(self, workspace_id: UUID, user_id: UUID) -> None:
        member = await self.workspace_repo.get_member(workspace_id, user_id)
        if not member:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a workspace member")


def _diff(task: Task, dto: UpdateTaskDTO) -> dict:
    """Return {field: [old, new]} for changed fields."""
    from app.features.tasks.schemas import _UNSET
    changes = {}
    fields = ["title", "description", "priority", "status_id", "reviewer_id", "due_date", "epic_id"]
    for field in fields:
        new_val = getattr(dto, field)
        if new_val is _UNSET:
            continue
        if new_val is None:
            continue
        old_val = getattr(task, field)
        old_str = old_val.value if hasattr(old_val, "value") else (str(old_val) if old_val is not None else None)
        new_str = new_val.value if hasattr(new_val, "value") else str(new_val)
        if old_str != new_str:
            # Don't store raw HTML for description — just flag it as edited
            if field == "description":
                changes[field] = ["edited"]
            else:
                changes[field] = [old_str, new_str]
    if dto.assignee_ids is not None:
        old_ids = [str(i) for i in task.assignee_ids]
        new_ids = [str(i) for i in dto.assignee_ids]
        if old_ids != new_ids:
            changes["assignee_ids"] = [old_ids, new_ids]
    return changes
