import enum
from uuid import uuid4

from sqlalchemy import Boolean, Enum, Float, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, SoftDeleteMixin, TimestampMixin


class StatusCategory(str, enum.Enum):
    not_started = "not_started"
    active = "active"
    done = "done"
    cancelled = "cancelled"


class ListStatus(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "list_statuses"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    list_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("lists.id"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    color: Mapped[str] = mapped_column(String(7), nullable=False, default="#6b7280")
    order_index: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    is_complete: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    category: Mapped[StatusCategory] = mapped_column(
        Enum(StatusCategory), nullable=False, default=StatusCategory.not_started
    )

    list_: Mapped["List"] = relationship(back_populates="statuses")
