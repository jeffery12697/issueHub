from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.automation import Automation


class AutomationRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def list_for_list(self, list_id: UUID) -> list[Automation]:
        result = await self.session.execute(
            select(Automation)
            .where(Automation.list_id == list_id)
            .where(Automation.deleted_at.is_(None))
            .order_by(Automation.created_at)
        )
        return list(result.scalars().all())

    async def get_by_id(self, automation_id: UUID) -> Automation | None:
        result = await self.session.execute(
            select(Automation)
            .where(Automation.id == automation_id)
            .where(Automation.deleted_at.is_(None))
        )
        return result.scalar_one_or_none()

    async def create(
        self,
        list_id: UUID,
        trigger_type: str,
        trigger_value: str,
        action_type: str,
        action_value: str | None,
        created_by: UUID,
    ) -> Automation:
        automation = Automation(
            id=uuid4(),
            list_id=list_id,
            trigger_type=trigger_type,
            trigger_value=trigger_value,
            action_type=action_type,
            action_value=action_value,
            created_by=created_by,
        )
        self.session.add(automation)
        await self.session.flush()
        return automation

    async def soft_delete(self, automation: Automation) -> None:
        from datetime import datetime, timezone
        automation.deleted_at = datetime.now(timezone.utc)
        await self.session.flush()
