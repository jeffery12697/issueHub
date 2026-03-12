import enum
from datetime import datetime
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, Enum, Float, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, SoftDeleteMixin, TimestampMixin


class FieldType(str, enum.Enum):
    text = "text"
    number = "number"
    date = "date"
    dropdown = "dropdown"
    checkbox = "checkbox"
    url = "url"


class CustomFieldDefinition(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "custom_field_definitions"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    list_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("lists.id"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    field_type: Mapped[FieldType] = mapped_column(Enum(FieldType), nullable=False)
    is_required: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    options_json: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    order_index: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)


class CustomFieldValue(Base, TimestampMixin):
    __tablename__ = "custom_field_values"

    __table_args__ = (
        UniqueConstraint("task_id", "field_id", name="uq_custom_field_values_task_field"),
    )

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    task_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tasks.id"), nullable=False, index=True
    )
    field_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("custom_field_definitions.id"), nullable=False, index=True
    )
    value_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    value_number: Mapped[float | None] = mapped_column(Float, nullable=True)
    value_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    value_boolean: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    value_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
