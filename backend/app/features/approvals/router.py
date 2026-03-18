from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.security import get_current_user
from app.features.approvals.repository import ApprovalRepository
from app.features.approvals.schemas import ApprovalResponse
from app.features.audit.repository import AuditRepository
from app.models.user import User

router = APIRouter(tags=["approvals"])


@router.get("/tasks/{task_id}/approvals", response_model=list[ApprovalResponse])
async def list_approvals(
    task_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    repo = ApprovalRepository(session)
    return await repo.list_for_task(task_id)


@router.post("/tasks/{task_id}/approve", status_code=status.HTTP_204_NO_CONTENT)
async def approve_task(
    task_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    repo = ApprovalRepository(session)
    audit = AuditRepository(session)
    already = await repo.is_approved_by(task_id, current_user.id)
    if not already:
        await repo.approve(task_id, current_user.id)
        await audit.log(
            task_id=task_id,
            actor_id=current_user.id,
            action="task_approved",
        )
    await session.commit()


@router.delete("/tasks/{task_id}/approve", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_approval(
    task_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    repo = ApprovalRepository(session)
    audit = AuditRepository(session)
    already = await repo.is_approved_by(task_id, current_user.id)
    if already:
        await repo.revoke(task_id, current_user.id)
        await audit.log(
            task_id=task_id,
            actor_id=current_user.id,
            action="task_approval_revoked",
        )
    await session.commit()
