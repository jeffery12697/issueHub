from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tag import Tag, TaskTag
from app.features.tags.schemas import CreateTagDTO, UpdateTagDTO


class TagRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def list_for_workspace(self, workspace_id: UUID) -> list[Tag]:
        result = await self.session.execute(
            select(Tag)
            .where(Tag.workspace_id == workspace_id)
            .order_by(Tag.name)
        )
        return list(result.scalars().all())

    async def get_by_id(self, tag_id: UUID) -> Tag | None:
        result = await self.session.execute(
            select(Tag).where(Tag.id == tag_id)
        )
        return result.scalar_one_or_none()

    async def create(self, dto: CreateTagDTO) -> Tag:
        tag = Tag(
            workspace_id=dto.workspace_id,
            name=dto.name,
            color=dto.color,
        )
        self.session.add(tag)
        await self.session.flush()
        return tag

    async def update(self, tag: Tag, dto: UpdateTagDTO) -> Tag:
        if dto.name is not None:
            tag.name = dto.name
        if dto.color is not None:
            tag.color = dto.color
        await self.session.flush()
        return tag

    async def delete(self, tag: Tag) -> None:
        await self.session.delete(tag)
        await self.session.flush()

    async def get_task_tag(self, task_id: UUID, tag_id: UUID) -> TaskTag | None:
        result = await self.session.execute(
            select(TaskTag)
            .where(TaskTag.task_id == task_id)
            .where(TaskTag.tag_id == tag_id)
        )
        return result.scalar_one_or_none()

    async def add_task_tag(self, task_id: UUID, tag_id: UUID) -> TaskTag:
        task_tag = TaskTag(task_id=task_id, tag_id=tag_id)
        self.session.add(task_tag)
        await self.session.flush()
        return task_tag

    async def remove_task_tag(self, task_tag: TaskTag) -> None:
        await self.session.delete(task_tag)
        await self.session.flush()

    async def list_tags_for_task(self, task_id: UUID) -> list[Tag]:
        result = await self.session.execute(
            select(Tag)
            .join(TaskTag, TaskTag.tag_id == Tag.id)
            .where(TaskTag.task_id == task_id)
            .order_by(Tag.name)
        )
        return list(result.scalars().all())

    async def get_tag_ids_for_tasks(self, task_ids: list[UUID]) -> dict[UUID, list[UUID]]:
        """Batch load tag_ids for multiple tasks. Returns {task_id: [tag_id, ...]}."""
        if not task_ids:
            return {}
        result = await self.session.execute(
            select(TaskTag.task_id, TaskTag.tag_id)
            .where(TaskTag.task_id.in_(task_ids))
        )
        mapping: dict[UUID, list[UUID]] = {}
        for row in result.all():
            mapping.setdefault(row.task_id, []).append(row.tag_id)
        return mapping
