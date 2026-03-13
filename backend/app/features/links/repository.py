from uuid import UUID
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.task_link import TaskLink
from app.features.links.schemas import CreateLinkDTO


class LinkRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, dto: CreateLinkDTO) -> TaskLink:
        link = TaskLink(task_id=dto.task_id, created_by=dto.created_by, url=dto.url, title=dto.title)
        self.session.add(link)
        await self.session.flush()
        return link

    async def list_for_task(self, task_id: UUID) -> list[TaskLink]:
        result = await self.session.execute(
            select(TaskLink)
            .where(TaskLink.task_id == task_id)
            .where(TaskLink.deleted_at.is_(None))
            .order_by(TaskLink.created_at)
        )
        return list(result.scalars().all())

    async def get_by_id(self, link_id: UUID) -> TaskLink | None:
        result = await self.session.execute(
            select(TaskLink)
            .where(TaskLink.id == link_id)
            .where(TaskLink.deleted_at.is_(None))
        )
        return result.scalar_one_or_none()

    async def soft_delete(self, link: TaskLink) -> None:
        link.soft_delete()
        await self.session.flush()
