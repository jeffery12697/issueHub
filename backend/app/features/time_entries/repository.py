from uuid import UUID, uuid4
from datetime import datetime, timezone
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.time_entry import TimeEntry

class TimeEntryRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, task_id: UUID, user_id: UUID, duration_minutes: int, note: str | None) -> TimeEntry:
        entry = TimeEntry(
            task_id=task_id,
            user_id=user_id,
            duration_minutes=duration_minutes,
            note=note,
            logged_at=datetime.now(timezone.utc),
        )
        self.session.add(entry)
        await self.session.flush()
        return entry

    async def list_for_task(self, task_id: UUID) -> list[TimeEntry]:
        result = await self.session.execute(
            select(TimeEntry)
            .where(TimeEntry.task_id == task_id)
            .order_by(TimeEntry.logged_at.desc())
        )
        return list(result.scalars().all())

    async def total_minutes(self, task_id: UUID) -> int:
        result = await self.session.execute(
            select(func.coalesce(func.sum(TimeEntry.duration_minutes), 0))
            .where(TimeEntry.task_id == task_id)
        )
        return result.scalar()

    async def get_by_id(self, entry_id: UUID) -> TimeEntry | None:
        result = await self.session.execute(
            select(TimeEntry).where(TimeEntry.id == entry_id)
        )
        return result.scalar_one_or_none()

    async def delete(self, entry: TimeEntry) -> None:
        await self.session.delete(entry)
        await self.session.flush()
