import enum
from uuid import uuid4

from sqlalchemy import Boolean, Enum, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class WidgetType(str, enum.Enum):
    completion_rate = "completion_rate"
    overdue_count = "overdue_count"
    member_workload = "member_workload"


class DashboardWidget(Base, TimestampMixin):
    __tablename__ = "dashboard_widgets"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    workspace_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    widget_type: Mapped[WidgetType] = mapped_column(Enum(WidgetType), nullable=False)
    config: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    visible_to_members: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
