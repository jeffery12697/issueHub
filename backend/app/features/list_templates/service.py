from uuid import UUID

from fastapi import HTTPException, status

from app.features.list_templates.repository import ListTemplateRepository
from app.features.list_templates.schemas import CreateListFromTemplateDTO, CreateTemplateDTO
from app.features.lists.repository import ListRepository
from app.features.lists.schemas import CreateListDTO, CreateStatusDTO
from app.features.projects.repository import ProjectRepository
from app.features.workspaces.repository import WorkspaceRepository
from app.models.list_ import List
from app.models.list_status import StatusCategory
from app.models.list_template import ListTemplate


class ListTemplateService:
    def __init__(
        self,
        repo: ListTemplateRepository,
        list_repo: ListRepository,
        project_repo: ProjectRepository,
        workspace_repo: WorkspaceRepository,
    ):
        self.repo = repo
        self.list_repo = list_repo
        self.project_repo = project_repo
        self.workspace_repo = workspace_repo

    async def list_templates(
        self, workspace_id: UUID, user_id: UUID
    ) -> list[ListTemplate]:
        await self._require_workspace_member(workspace_id, user_id)
        return await self.repo.list_for_workspace(workspace_id)

    async def create_template(
        self, workspace_id: UUID, dto: CreateTemplateDTO, actor_id: UUID
    ) -> ListTemplate:
        await self._require_workspace_member(workspace_id, actor_id)
        full_dto = CreateTemplateDTO(
            workspace_id=workspace_id,
            name=dto.name,
            default_statuses=dto.default_statuses,
        )
        return await self.repo.create(full_dto)

    async def delete_template(
        self, workspace_id: UUID, template_id: UUID, actor_id: UUID
    ) -> None:
        await self._require_workspace_member(workspace_id, actor_id)
        template = await self._get_template_or_404(template_id, workspace_id)
        await self.repo.delete(template)

    async def create_list_from_template(
        self, project_id: UUID, dto: CreateListFromTemplateDTO, actor_id: UUID
    ) -> List:
        project = await self.project_repo.get_by_id(project_id)
        if not project:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
        await self._require_workspace_member(project.workspace_id, actor_id)

        template = await self.repo.get_by_id(dto.template_id)
        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Template not found"
            )

        # Create the list
        list_dto = CreateListDTO(
            project_id=project_id,
            name=dto.name,
            description=None,
            created_by=actor_id,
        )
        list_ = await self.list_repo.create(list_dto)

        # Create statuses from template
        for status_def in template.default_statuses:
            category_str = status_def.get("category", "not_started")
            try:
                category = StatusCategory(category_str)
            except ValueError:
                category = StatusCategory.not_started

            status_dto = CreateStatusDTO(
                list_id=list_.id,
                name=status_def.get("name", "Status"),
                color=status_def.get("color", "#6b7280"),
                category=category,
                order_index=float(status_def.get("order_index", 100.0)),
            )
            await self.list_repo.create_status(status_dto)

        return list_

    async def _require_workspace_member(self, workspace_id: UUID, user_id: UUID) -> None:
        member = await self.workspace_repo.get_member(workspace_id, user_id)
        if not member:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Not a workspace member"
            )

    async def _get_template_or_404(
        self, template_id: UUID, workspace_id: UUID
    ) -> ListTemplate:
        template = await self.repo.get_by_id(template_id)
        if not template or template.workspace_id != workspace_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Template not found"
            )
        return template
