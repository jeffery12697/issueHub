from uuid import UUID

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.task_approval import TaskApproval
from app.models.user import User
from app.features.approvals.schemas import ApprovalResponse


class ApprovalRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    # ── Internal (IssueHub user) ──────────────────────────────────────────────

    async def approve(self, task_id: UUID, user_id: UUID) -> None:
        existing = await self._get_internal(task_id, user_id)
        if existing:
            return
        self.session.add(TaskApproval(task_id=task_id, user_id=user_id, source="internal"))
        await self.session.flush()

    async def revoke(self, task_id: UUID, user_id: UUID) -> None:
        await self.session.execute(
            delete(TaskApproval)
            .where(TaskApproval.task_id == task_id)
            .where(TaskApproval.user_id == user_id)
        )
        await self.session.flush()

    async def is_approved_by(self, task_id: UUID, user_id: UUID) -> bool:
        return await self._get_internal(task_id, user_id) is not None

    async def _get_internal(self, task_id: UUID, user_id: UUID) -> TaskApproval | None:
        result = await self.session.execute(
            select(TaskApproval)
            .where(TaskApproval.task_id == task_id)
            .where(TaskApproval.user_id == user_id)
        )
        return result.scalar_one_or_none()

    # ── External (GitHub / GitLab webhook) ────────────────────────────────────

    async def approve_external(
        self,
        task_id: UUID,
        source: str,
        external_name: str,
        external_email: str | None,
    ) -> None:
        existing = await self._get_external(task_id, source, external_name)
        if existing:
            return
        self.session.add(TaskApproval(
            task_id=task_id,
            user_id=None,
            source=source,
            external_name=external_name,
            external_email=external_email,
        ))
        await self.session.flush()

    async def _get_external(
        self, task_id: UUID, source: str, external_name: str
    ) -> TaskApproval | None:
        result = await self.session.execute(
            select(TaskApproval)
            .where(TaskApproval.task_id == task_id)
            .where(TaskApproval.user_id.is_(None))
            .where(TaskApproval.source == source)
            .where(TaskApproval.external_name == external_name)
        )
        return result.scalar_one_or_none()

    # ── User lookup (for webhook email matching) ──────────────────────────────

    async def find_user_by_email(self, email: str) -> User | None:
        result = await self.session.execute(
            select(User)
            .where(User.email == email)
            .where(User.deleted_at.is_(None))
        )
        return result.scalar_one_or_none()

    # ── List ──────────────────────────────────────────────────────────────────

    async def list_for_task(self, task_id: UUID) -> list[ApprovalResponse]:
        result = await self.session.execute(
            select(TaskApproval, User)
            .outerjoin(User, TaskApproval.user_id == User.id)
            .where(TaskApproval.task_id == task_id)
            .order_by(TaskApproval.created_at.asc())
        )
        approvals = []
        for approval, user in result.all():
            if user:
                display_name = user.display_name
                avatar_url = user.avatar_url
            else:
                display_name = approval.external_name or "Unknown"
                avatar_url = None
            approvals.append(ApprovalResponse(
                user_id=approval.user_id,
                display_name=display_name,
                avatar_url=avatar_url,
                approved_at=approval.created_at,
                source=approval.source,
                external_name=approval.external_name,
                external_email=approval.external_email,
            ))
        return approvals
