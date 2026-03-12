from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.list_template import ListTemplate
from app.features.list_templates.schemas import CreateTemplateDTO, UpdateTemplateDTO


class ListTemplateRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def list_for_workspace(self, workspace_id: UUID) -> list[ListTemplate]:
        result = await self.session.execute(
            select(ListTemplate)
            .where(ListTemplate.workspace_id == workspace_id)
            .order_by(ListTemplate.created_at)
        )
        return list(result.scalars().all())

    async def get_by_id(self, template_id: UUID) -> ListTemplate | None:
        result = await self.session.execute(
            select(ListTemplate).where(ListTemplate.id == template_id)
        )
        return result.scalar_one_or_none()

    async def create(self, dto: CreateTemplateDTO) -> ListTemplate:
        template = ListTemplate(
            workspace_id=dto.workspace_id,
            name=dto.name,
            default_statuses=dto.default_statuses,
            default_custom_fields=dto.default_custom_fields,
        )
        self.session.add(template)
        await self.session.flush()
        return template

    async def delete(self, template: ListTemplate) -> None:
        await self.session.delete(template)
        await self.session.flush()

    async def update(self, template: ListTemplate, dto: UpdateTemplateDTO) -> ListTemplate:
        if dto.name is not None:
            template.name = dto.name
        if dto.default_statuses is not None:
            template.default_statuses = dto.default_statuses
        if dto.default_custom_fields is not None:
            template.default_custom_fields = dto.default_custom_fields
        await self.session.flush()
        return template
