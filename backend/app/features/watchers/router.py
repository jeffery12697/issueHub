from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.security import get_current_user
from app.features.watchers.repository import WatcherRepository
from app.models.user import User

router = APIRouter(tags=["watchers"])


@router.post("/tasks/{task_id}/watch", status_code=status.HTTP_204_NO_CONTENT)
async def watch_task(
    task_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    repo = WatcherRepository(session)
    await repo.watch(task_id, current_user.id)
    await session.commit()


@router.delete("/tasks/{task_id}/watch", status_code=status.HTTP_204_NO_CONTENT)
async def unwatch_task(
    task_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    repo = WatcherRepository(session)
    await repo.unwatch(task_id, current_user.id)
    await session.commit()


@router.get("/tasks/{task_id}/watch")
async def get_watch_status(
    task_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    repo = WatcherRepository(session)
    watcher = await repo.get(task_id, current_user.id)
    return {"watching": watcher is not None}
