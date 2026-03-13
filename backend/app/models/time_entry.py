from uuid import uuid4
from datetime import datetime
from sqlalchemy import ForeignKey, Integer, Text, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, TimestampMixin

class TimeEntry(Base, TimestampMixin):
    __tablename__ = "time_entries"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    task_id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tasks.id"), nullable=False, index=True)
    user_id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    logged_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
