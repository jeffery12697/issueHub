from datetime import datetime
from uuid import UUID
from pydantic import BaseModel


class ApprovalResponse(BaseModel):
    user_id: UUID
    display_name: str
    avatar_url: str | None
    approved_at: datetime
