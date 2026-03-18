from uuid import UUID

from fastapi import HTTPException, status

from app.features.tags.repository import TagRepository
from app.features.tags.schemas import CreateTagDTO, UpdateTagDTO
from app.features.workspaces.repository import WorkspaceRepository
from app.features.lists.repository import ListRepository
from app.features.tasks.repository import TaskRepository
from app.features.teams.repository import TeamRepository
from app.models.tag import Tag, TaskTag
from app.models.workspace import WorkspaceRole


class TagService:
    def __init__(
        self,
        repo: TagRepository,
        workspace_repo: WorkspaceRepository,
        list_repo: ListRepository,
        task_repo: TaskRepository,
        team_repo: TeamRepository | None = None,
    ):
        self.repo = repo
        self.workspace_repo = workspace_repo
        self.list_repo = list_repo
        self.task_repo = task_repo
        self.team_repo = team_repo

    # --- Workspace tag management ---

    async def list_tags(self, workspace_id: UUID, user_id: UUID) -> list[Tag]:
        await self._require_member(workspace_id, user_id)
        return await self.repo.list_for_workspace(workspace_id)

    async def create(self, workspace_id: UUID, dto: CreateTagDTO, actor_id: UUID) -> Tag:
        await self._require_admin(workspace_id, actor_id)
        return await self.repo.create(dto)

    async def update(self, workspace_id: UUID, tag_id: UUID, dto: UpdateTagDTO, actor_id: UUID) -> Tag:
        await self._require_admin(workspace_id, actor_id)
        tag = await self._get_tag_or_404(tag_id, workspace_id)
        return await self.repo.update(tag, dto)

    async def delete(self, workspace_id: UUID, tag_id: UUID, actor_id: UUID) -> None:
        await self._require_admin(workspace_id, actor_id)
        tag = await self._get_tag_or_404(tag_id, workspace_id)
        await self.repo.delete(tag)

    # --- Task tag assignments ---

    async def list_tags_for_task(self, task_id: UUID, user_id: UUID) -> list[Tag]:
        task = await self._get_task_or_404(task_id)
        await self._require_task_access(task, user_id)
        return await self.repo.list_tags_for_task(task_id)

    async def add_tag_to_task(self, task_id: UUID, tag_id: UUID, actor_id: UUID) -> TaskTag:
        task = await self._get_task_or_404(task_id)
        await self._require_task_access(task, actor_id)

        # Verify tag belongs to same workspace
        tag = await self.repo.get_by_id(tag_id)
        if not tag or tag.workspace_id != task.workspace_id:
            raise HTTPException(status_code=404, detail="Tag not found")

        # Idempotent — ignore duplicate
        existing = await self.repo.get_task_tag(task_id, tag_id)
        if existing:
            return existing

        return await self.repo.add_task_tag(task_id, tag_id)

    async def remove_tag_from_task(self, task_id: UUID, tag_id: UUID, actor_id: UUID) -> None:
        task = await self._get_task_or_404(task_id)
        await self._require_task_access(task, actor_id)

        task_tag = await self.repo.get_task_tag(task_id, tag_id)
        if not task_tag:
            raise HTTPException(status_code=404, detail="Tag not assigned to this task")
        await self.repo.remove_task_tag(task_tag)

    # --- Helpers ---

    async def _require_member(self, workspace_id: UUID, user_id: UUID) -> None:
        member = await self.workspace_repo.get_member(workspace_id, user_id)
        if not member:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a workspace member")

    async def _require_admin(self, workspace_id: UUID, user_id: UUID) -> None:
        member = await self.workspace_repo.get_member(workspace_id, user_id)
        if not member or member.role not in (WorkspaceRole.owner, WorkspaceRole.admin):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")

    async def _get_tag_or_404(self, tag_id: UUID, workspace_id: UUID) -> Tag:
        tag = await self.repo.get_by_id(tag_id)
        if not tag or tag.workspace_id != workspace_id:
            raise HTTPException(status_code=404, detail="Tag not found")
        return tag

    async def _get_task_or_404(self, task_id: UUID):
        task = await self.task_repo.get_by_id(task_id)
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        return task

    async def _require_task_access(self, task, user_id: UUID) -> None:
        """Enforce list visibility rules — same check as task service."""
        member = await self.workspace_repo.get_member(task.workspace_id, user_id)
        if not member:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a workspace member")

        # Check team-restricted list visibility
        if task.list_id and self.team_repo:
            list_ = await self.list_repo.get_by_id(task.list_id)
            if list_ and list_.team_ids and member.role not in (WorkspaceRole.owner, WorkspaceRole.admin):
                is_team_member = await self.team_repo.is_member(list_.team_id, user_id)
                if not is_team_member:
                    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
