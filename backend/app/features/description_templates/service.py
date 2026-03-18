from uuid import UUID

from fastapi import HTTPException, status

from app.features.description_templates.repository import DescriptionTemplateRepository
from app.features.description_templates.schemas import (
    CreateDescriptionTemplateDTO,
    UpdateDescriptionTemplateDTO,
)
from app.features.workspaces.repository import WorkspaceRepository
from app.models.description_template import DescriptionTemplate
from app.models.workspace import WorkspaceRole


class DescriptionTemplateService:
    def __init__(
        self,
        repo: DescriptionTemplateRepository,
        workspace_repo: WorkspaceRepository,
    ):
        self.repo = repo
        self.workspace_repo = workspace_repo

    async def list_templates(
        self, workspace_id: UUID, user_id: UUID
    ) -> list[DescriptionTemplate]:
        await self._require_member(workspace_id, user_id)
        return await self.repo.list_for_workspace(workspace_id)

    async def create(
        self, workspace_id: UUID, dto: CreateDescriptionTemplateDTO, actor_id: UUID
    ) -> DescriptionTemplate:
        await self._require_admin(workspace_id, actor_id)
        return await self.repo.create(dto)

    async def update(
        self,
        workspace_id: UUID,
        template_id: UUID,
        dto: UpdateDescriptionTemplateDTO,
        actor_id: UUID,
    ) -> DescriptionTemplate:
        await self._require_admin(workspace_id, actor_id)
        template = await self._get_or_404(template_id, workspace_id)
        return await self.repo.update(template, dto)

    async def delete(
        self, workspace_id: UUID, template_id: UUID, actor_id: UUID
    ) -> None:
        await self._require_admin(workspace_id, actor_id)
        template = await self._get_or_404(template_id, workspace_id)
        await self.repo.delete(template)

    async def _require_member(self, workspace_id: UUID, user_id: UUID) -> None:
        member = await self.workspace_repo.get_member(workspace_id, user_id)
        if not member:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not a workspace member",
            )

    async def _require_admin(self, workspace_id: UUID, user_id: UUID) -> None:
        member = await self.workspace_repo.get_member(workspace_id, user_id)
        if not member or member.role not in {WorkspaceRole.owner, WorkspaceRole.admin}:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )

    async def _get_or_404(
        self, template_id: UUID, workspace_id: UUID
    ) -> DescriptionTemplate:
        template = await self.repo.get_by_id(template_id)
        if not template or template.workspace_id != workspace_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Template not found",
            )
        return template
