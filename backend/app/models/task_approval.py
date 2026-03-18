from uuid import uuid4

from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class TaskApproval(Base, TimestampMixin):
    __tablename__ = "task_approvals"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    task_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # Internal approval — linked to an IssueHub user
    user_id: Mapped[UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True
    )
    # Source: "internal" | "github" | "gitlab"
    source: Mapped[str] = mapped_column(String(32), nullable=False, default="internal")
    # External approval fields (used when user_id is None)
    external_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    external_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
