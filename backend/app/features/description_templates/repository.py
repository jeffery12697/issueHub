from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.description_template import DescriptionTemplate
from app.features.description_templates.schemas import (
    CreateDescriptionTemplateDTO,
    UpdateDescriptionTemplateDTO,
)


class DescriptionTemplateRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def list_for_workspace(self, workspace_id: UUID) -> list[DescriptionTemplate]:
        result = await self.session.execute(
            select(DescriptionTemplate)
            .where(DescriptionTemplate.workspace_id == workspace_id)
            .order_by(DescriptionTemplate.created_at)
        )
        return list(result.scalars().all())

    async def get_by_id(self, template_id: UUID) -> DescriptionTemplate | None:
        result = await self.session.execute(
            select(DescriptionTemplate).where(DescriptionTemplate.id == template_id)
        )
        return result.scalar_one_or_none()

    async def create(self, dto: CreateDescriptionTemplateDTO) -> DescriptionTemplate:
        template = DescriptionTemplate(
            workspace_id=dto.workspace_id,
            name=dto.name,
            content=dto.content,
            created_by=dto.created_by,
        )
        self.session.add(template)
        await self.session.flush()
        return template

    async def update(
        self, template: DescriptionTemplate, dto: UpdateDescriptionTemplateDTO
    ) -> DescriptionTemplate:
        if dto.name is not None:
            template.name = dto.name
        if dto.content is not None:
            template.content = dto.content
        await self.session.flush()
        return template

    async def delete(self, template: DescriptionTemplate) -> None:
        await self.session.delete(template)
        await self.session.flush()
