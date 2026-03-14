from uuid import UUID

from fastapi import HTTPException, status

from app.features.automations.repository import AutomationRepository
from app.features.automations.schemas import CreateAutomationRequest
from app.features.lists.repository import ListRepository
from app.features.projects.repository import ProjectRepository
from app.features.workspaces.repository import WorkspaceRepository
from app.models.automation import Automation, ActionType, TriggerType
from app.models.workspace import WorkspaceRole


class AutomationService:
    def __init__(
        self,
        repo: AutomationRepository,
        list_repo: ListRepository,
        project_repo: ProjectRepository,
        workspace_repo: WorkspaceRepository,
    ):
        self.repo = repo
        self.list_repo = list_repo
        self.project_repo = project_repo
        self.workspace_repo = workspace_repo

    async def list_for_list(self, list_id: UUID, user_id: UUID) -> list[Automation]:
        list_ = await self.list_repo.get_by_id(list_id)
        if not list_:
            raise HTTPException(status_code=404, detail="List not found")
        project = await self.project_repo.get_by_id(list_.project_id)
        await self._require_workspace_member(project.workspace_id, user_id)
        return await self.repo.list_for_list(list_id)

    async def create(
        self,
        list_id: UUID,
        body: CreateAutomationRequest,
        creator_id: UUID,
    ) -> Automation:
        list_ = await self.list_repo.get_by_id(list_id)
        if not list_:
            raise HTTPException(status_code=404, detail="List not found")
        project = await self.project_repo.get_by_id(list_.project_id)
        await self._require_role(project.workspace_id, creator_id)
        return await self.repo.create(
            list_id=list_id,
            trigger_type=body.trigger_type.value,
            trigger_value=body.trigger_value,
            action_type=body.action_type.value,
            action_value=body.action_value,
            created_by=creator_id,
        )

    async def delete(self, automation_id: UUID, actor_id: UUID) -> None:
        automation = await self.repo.get_by_id(automation_id)
        if not automation:
            raise HTTPException(status_code=404, detail="Automation not found")
        list_ = await self.list_repo.get_by_id(automation.list_id)
        project = await self.project_repo.get_by_id(list_.project_id)
        await self._require_role(project.workspace_id, actor_id)
        await self.repo.soft_delete(automation)

    async def _require_role(self, workspace_id: UUID, user_id: UUID) -> None:
        member = await self.workspace_repo.get_member(workspace_id, user_id)
        if not member or member.role not in {WorkspaceRole.owner, WorkspaceRole.admin}:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

    async def _require_workspace_member(self, workspace_id: UUID, user_id: UUID) -> None:
        member = await self.workspace_repo.get_member(workspace_id, user_id)
        if not member:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a workspace member")
