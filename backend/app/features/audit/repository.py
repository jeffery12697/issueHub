from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import outerjoin

from app.models.audit_log import AuditLog
from app.models.user import User


class AuditRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def log(
        self,
        task_id: UUID,
        actor_id: UUID | None,
        action: str,
        changes: dict | None = None,
    ) -> AuditLog:
        entry = AuditLog(
            task_id=task_id,
            actor_id=actor_id,
            action=action,
            changes=changes,
        )
        self.session.add(entry)
        await self.session.flush()
        return entry

    async def list_for_task(self, task_id: UUID) -> list[tuple[AuditLog, str | None]]:
        result = await self.session.execute(
            select(AuditLog, User.display_name)
            .outerjoin(User, User.id == AuditLog.actor_id)
            .where(AuditLog.task_id == task_id)
            .order_by(AuditLog.created_at.desc())
        )
        return list(result.all())
