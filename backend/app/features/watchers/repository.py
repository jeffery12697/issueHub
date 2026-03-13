from uuid import UUID

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.watcher import TaskWatcher


class WatcherRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def watch(self, task_id: UUID, user_id: UUID) -> TaskWatcher:
        existing = await self.get(task_id, user_id)
        if existing:
            return existing
        watcher = TaskWatcher(task_id=task_id, user_id=user_id)
        self.session.add(watcher)
        await self.session.flush()
        return watcher

    async def unwatch(self, task_id: UUID, user_id: UUID) -> None:
        await self.session.execute(
            delete(TaskWatcher)
            .where(TaskWatcher.task_id == task_id)
            .where(TaskWatcher.user_id == user_id)
        )
        await self.session.flush()

    async def get(self, task_id: UUID, user_id: UUID) -> TaskWatcher | None:
        result = await self.session.execute(
            select(TaskWatcher)
            .where(TaskWatcher.task_id == task_id)
            .where(TaskWatcher.user_id == user_id)
        )
        return result.scalar_one_or_none()

    async def list_watcher_ids(self, task_id: UUID) -> list[UUID]:
        result = await self.session.execute(
            select(TaskWatcher.user_id).where(TaskWatcher.task_id == task_id)
        )
        return list(result.scalars().all())
