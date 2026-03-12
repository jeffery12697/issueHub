from datetime import datetime
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class TaskDependency(Base):
    __tablename__ = "task_dependencies"
    __table_args__ = (UniqueConstraint("task_id", "depends_on_id"),)

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    # task_id is BLOCKED BY depends_on_id
    task_id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tasks.id"), nullable=False, index=True)
    depends_on_id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tasks.id"), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
