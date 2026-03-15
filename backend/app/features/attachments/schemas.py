from uuid import UUID
from datetime import datetime
from pydantic import BaseModel


class AttachmentResponse(BaseModel):
    id: UUID
    task_id: UUID
    comment_id: UUID | None
    uploaded_by: UUID
    filename: str
    size: int
    mime_type: str
    created_at: datetime
    url: str  # presigned download URL, injected at response time

    model_config = {"from_attributes": True}
