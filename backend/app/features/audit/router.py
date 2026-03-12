from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.security import get_current_user
from app.features.audit.repository import AuditRepository
from app.features.audit.schemas import AuditLogResponse
from app.features.tasks.repository import TaskRepository
from app.models.user import User

router = APIRouter(tags=["audit"])


@router.get("/tasks/{task_id}/audit", response_model=list[AuditLogResponse])
async def get_task_audit(
    task_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    repo = AuditRepository(session)
    rows = await repo.list_for_task(task_id)
    return [
        AuditLogResponse(
            id=log.id,
            task_id=log.task_id,
            actor_id=log.actor_id,
            actor_name=display_name,
            action=log.action,
            changes=log.changes,
            created_at=log.created_at,
        )
        for log, display_name in rows
    ]
