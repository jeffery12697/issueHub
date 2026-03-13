from uuid import UUID
from datetime import datetime
from pydantic import BaseModel


class NotificationResponse(BaseModel):
    id: UUID
    user_id: UUID
    task_id: UUID
    type: str
    body: str
    is_read: bool
    meta: dict
    created_at: datetime

    model_config = {"from_attributes": True}
