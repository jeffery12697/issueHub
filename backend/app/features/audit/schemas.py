from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class AuditLogResponse(BaseModel):
    id: UUID
    task_id: UUID
    actor_id: UUID | None
    actor_name: str | None
    action: str
    changes: dict | None
    created_at: datetime
