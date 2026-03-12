from uuid import UUID as PyUUID, uuid4

from sqlalchemy import ARRAY, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, SoftDeleteMixin, TimestampMixin


class Comment(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "comments"

    id: Mapped[PyUUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    task_id: Mapped[PyUUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tasks.id"), nullable=False, index=True
    )
    author_id: Mapped[PyUUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    body: Mapped[str] = mapped_column(Text, nullable=False)
    parent_comment_id: Mapped[PyUUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("comments.id"), nullable=True
    )
    mentions: Mapped[list[PyUUID]] = mapped_column(
        ARRAY(UUID(as_uuid=True)), nullable=False, default=list
    )
