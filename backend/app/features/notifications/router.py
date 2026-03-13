from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from app.core.database import get_session
from app.core.security import get_current_user
from app.features.notifications.repository import NotificationRepository
from app.features.notifications.schemas import NotificationResponse
from app.models.user import User

router = APIRouter(tags=["notifications"])


@router.get("/users/me/notifications", response_model=list[NotificationResponse])
async def list_notifications(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    repo = NotificationRepository(session)
    return await repo.list_for_user(current_user.id)


@router.get("/users/me/notifications/unread-count")
async def unread_count(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    repo = NotificationRepository(session)
    count = await repo.unread_count(current_user.id)
    return {"count": count}


@router.patch("/users/me/notifications/{notification_id}/read", status_code=204)
async def mark_read(
    notification_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    repo = NotificationRepository(session)
    await repo.mark_read(notification_id, current_user.id)
    await session.commit()


@router.patch("/users/me/notifications/read-all", status_code=204)
async def mark_all_read(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    repo = NotificationRepository(session)
    await repo.mark_all_read(current_user.id)
    await session.commit()
