import enum
from datetime import datetime
from uuid import UUID as PyUUID, uuid4

from sqlalchemy import ARRAY, DateTime, Enum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy_utils import LtreeType

from app.models.base import Base, SoftDeleteMixin, TimestampMixin


class Priority(str, enum.Enum):
    none = "none"
    low = "low"
    medium = "medium"
    high = "high"
    urgent = "urgent"


class Task(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "tasks"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    workspace_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workspaces.id"), nullable=False, index=True
    )
    project_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False, index=True
    )
    list_id: Mapped[UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("lists.id"), nullable=True, index=True
    )
    parent_task_id: Mapped[UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tasks.id"), nullable=True, index=True
    )
    status_id: Mapped[UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("list_statuses.id"), nullable=True
    )
    reporter_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    reviewer_id: Mapped[UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )

    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    priority: Mapped[Priority] = mapped_column(
        Enum(Priority), nullable=False, default=Priority.none
    )
    assignee_ids: Mapped[list[PyUUID]] = mapped_column(
        ARRAY(UUID(as_uuid=True)), nullable=False, default=list
    )
    due_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    order_index: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    depth: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    path: Mapped[str] = mapped_column(LtreeType, nullable=False)

    subtasks: Mapped[list["Task"]] = relationship(
        "Task",
        foreign_keys=[parent_task_id],
        lazy="raise",
    )
