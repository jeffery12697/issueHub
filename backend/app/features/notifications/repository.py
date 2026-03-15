from datetime import timedelta
from uuid import UUID
from sqlalchemy import select, update, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.notification import Notification


class NotificationRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, user_id: UUID, task_id: UUID, type_: str, body: str, meta: dict = {}) -> Notification:
        n = Notification(user_id=user_id, task_id=task_id, type=type_, body=body, meta=meta)
        self.session.add(n)
        await self.session.flush()
        return n

    async def list_for_user(self, user_id: UUID, limit: int = 50) -> list[Notification]:
        result = await self.session.execute(
            select(Notification)
            .where(Notification.user_id == user_id)
            .order_by(Notification.created_at.desc())
            .limit(limit)
        )
        return list(result.scalars().all())

    async def mark_read(self, notification_id: UUID, user_id: UUID) -> None:
        await self.session.execute(
            update(Notification)
            .where(Notification.id == notification_id)
            .where(Notification.user_id == user_id)
            .values(is_read=True)
        )
        await self.session.flush()

    async def mark_all_read(self, user_id: UUID) -> None:
        await self.session.execute(
            update(Notification)
            .where(Notification.user_id == user_id)
            .where(Notification.is_read == False)  # noqa: E712
            .values(is_read=True)
        )
        await self.session.flush()

    async def unread_count(self, user_id: UUID) -> int:
        result = await self.session.execute(
            select(func.count())
            .where(Notification.user_id == user_id)
            .where(Notification.is_read == False)  # noqa: E712
        )
        return result.scalar_one()

    async def get_unread_grouped_by_user(self, since_hours: int) -> dict[UUID, list[Notification]]:
        """Return unread notifications from the past N hours, grouped by user_id.
        Only includes users with notification_preference = 'digest'.
        """
        from app.models.user import User
        cutoff = func.now() - func.cast(
            func.concat(since_hours, " hours"), type_=None
        )
        result = await self.session.execute(
            select(Notification)
            .join(User, User.id == Notification.user_id)
            .where(Notification.is_read == False)  # noqa: E712
            .where(Notification.created_at >= func.now() - timedelta(hours=since_hours))
            .where(User.notification_preference == "digest")
            .where(User.deleted_at.is_(None))
            .order_by(Notification.created_at.desc())
        )
        notifications = result.scalars().all()
        grouped: dict[UUID, list[Notification]] = {}
        for n in notifications:
            grouped.setdefault(n.user_id, []).append(n)
        return grouped
