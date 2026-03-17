from uuid import uuid4

from sqlalchemy import ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class StatusMapping(Base, TimestampMixin):
    """Cross-list status mapping rule (S-04).

    When a task moves from from_list with from_status, it receives to_status
    in to_list instead of having its status cleared.
    """

    __tablename__ = "status_mappings"
    __table_args__ = (
        UniqueConstraint(
            "from_list_id", "to_list_id", "from_status_id",
            name="uq_status_mapping_from_to",
        ),
    )

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    project_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False, index=True
    )
    from_list_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("lists.id"), nullable=False
    )
    from_status_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("list_statuses.id"), nullable=False
    )
    to_list_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("lists.id"), nullable=False
    )
    to_status_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("list_statuses.id"), nullable=False
    )
