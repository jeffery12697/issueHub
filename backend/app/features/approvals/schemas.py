from datetime import datetime
from uuid import UUID
from pydantic import BaseModel


class ApprovalResponse(BaseModel):
    user_id: UUID | None
    display_name: str
    avatar_url: str | None
    approved_at: datetime
    source: str              # "internal" | "github" | "gitlab"
    external_name: str | None = None
    external_email: str | None = None
