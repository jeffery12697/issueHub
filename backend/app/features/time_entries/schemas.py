from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, Field

class LogTimeRequest(BaseModel):
    duration_minutes: int = Field(..., ge=1)
    note: str | None = None

class TimeEntryResponse(BaseModel):
    id: UUID
    task_id: UUID
    user_id: UUID
    duration_minutes: int
    note: str | None
    logged_at: datetime

    model_config = {"from_attributes": True}

class TimeEntrySummaryResponse(BaseModel):
    entries: list[TimeEntryResponse]
    total_minutes: int
