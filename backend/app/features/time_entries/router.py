from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_session
from app.core.security import get_current_user
from app.features.time_entries.repository import TimeEntryRepository
from app.features.time_entries.schemas import LogTimeRequest, TimeEntryResponse, TimeEntrySummaryResponse
from app.features.audit.repository import AuditRepository
from app.models.user import User

router = APIRouter(tags=["time_entries"])

@router.post("/tasks/{task_id}/time-entries", response_model=TimeEntryResponse, status_code=201)
async def log_time(
    task_id: UUID,
    body: LogTimeRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    repo = TimeEntryRepository(session)
    entry = await repo.create(task_id, current_user.id, body.duration_minutes, body.note)
    audit = AuditRepository(session)
    await audit.log(
        task_id=task_id,
        actor_id=current_user.id,
        action="time_logged",
        changes={"duration_minutes": body.duration_minutes, "note": body.note},
    )
    await session.commit()
    return TimeEntryResponse.model_validate(entry)

@router.get("/tasks/{task_id}/time-entries", response_model=TimeEntrySummaryResponse)
async def list_time_entries(
    task_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    repo = TimeEntryRepository(session)
    entries = await repo.list_for_task(task_id)
    total = await repo.total_minutes(task_id)
    return TimeEntrySummaryResponse(
        entries=[TimeEntryResponse.model_validate(e) for e in entries],
        total_minutes=total,
    )

@router.delete("/tasks/{task_id}/time-entries/{entry_id}", status_code=204)
async def delete_time_entry(
    task_id: UUID,
    entry_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    repo = TimeEntryRepository(session)
    entry = await repo.get_by_id(entry_id)
    if not entry or entry.task_id != task_id:
        raise HTTPException(status_code=404, detail="Time entry not found")
    if entry.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Cannot delete another user's time entry")
    await repo.delete(entry)
    await session.commit()
