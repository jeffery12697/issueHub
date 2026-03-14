import enum
from uuid import uuid4

from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, SoftDeleteMixin


class TriggerType(str, enum.Enum):
    status_changed = "status_changed"
    priority_changed = "priority_changed"


class ActionType(str, enum.Enum):
    set_status = "set_status"
    set_priority = "set_priority"
    assign_reviewer = "assign_reviewer"
    clear_assignees = "clear_assignees"


class Automation(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "automations"

    id: Mapped[uuid4] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    list_id: Mapped[uuid4] = mapped_column(
        UUID(as_uuid=True), ForeignKey("lists.id"), nullable=False, index=True
    )
    trigger_type: Mapped[str] = mapped_column(String(50), nullable=False)
    trigger_value: Mapped[str] = mapped_column(String(255), nullable=False)
    action_type: Mapped[str] = mapped_column(String(50), nullable=False)
    action_value: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_by: Mapped[uuid4] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
