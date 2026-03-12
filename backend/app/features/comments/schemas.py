from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class CreateCommentRequest(BaseModel):
    body: str
    parent_comment_id: UUID | None = None


@dataclass(frozen=True)
class CreateCommentDTO:
    task_id: UUID
    author_id: UUID
    body: str
    parent_comment_id: UUID | None
    mentions: list[UUID]


class CommentResponse(BaseModel):
    id: UUID
    task_id: UUID
    author_id: UUID
    author_name: str
    body: str
    parent_comment_id: UUID | None
    mentions: list[UUID]
    created_at: datetime
    updated_at: datetime
