from uuid import UUID

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.task_approval import TaskApproval
from app.models.user import User
from app.features.approvals.schemas import ApprovalResponse


class ApprovalRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def approve(self, task_id: UUID, user_id: UUID) -> None:
        existing = await self._get(task_id, user_id)
        if existing:
            return
        approval = TaskApproval(task_id=task_id, user_id=user_id)
        self.session.add(approval)
        await self.session.flush()

    async def revoke(self, task_id: UUID, user_id: UUID) -> None:
        await self.session.execute(
            delete(TaskApproval)
            .where(TaskApproval.task_id == task_id)
            .where(TaskApproval.user_id == user_id)
        )
        await self.session.flush()

    async def is_approved_by(self, task_id: UUID, user_id: UUID) -> bool:
        return await self._get(task_id, user_id) is not None

    async def _get(self, task_id: UUID, user_id: UUID) -> TaskApproval | None:
        result = await self.session.execute(
            select(TaskApproval)
            .where(TaskApproval.task_id == task_id)
            .where(TaskApproval.user_id == user_id)
        )
        return result.scalar_one_or_none()

    async def list_for_task(self, task_id: UUID) -> list[ApprovalResponse]:
        result = await self.session.execute(
            select(TaskApproval, User)
            .join(User, TaskApproval.user_id == User.id)
            .where(TaskApproval.task_id == task_id)
            .where(User.deleted_at.is_(None))
            .order_by(TaskApproval.created_at.asc())
        )
        return [
            ApprovalResponse(
                user_id=approval.user_id,
                display_name=user.display_name,
                avatar_url=user.avatar_url,
                approved_at=approval.created_at,
            )
            for approval, user in result.all()
        ]
