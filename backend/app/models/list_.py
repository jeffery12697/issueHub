from uuid import uuid4

from sqlalchemy import ARRAY, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, SoftDeleteMixin, TimestampMixin


class List(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "lists"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    project_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    team_ids: Mapped[list[UUID]] = mapped_column(
        ARRAY(UUID(as_uuid=True)), nullable=True, default=list, server_default="{}"
    )

    statuses: Mapped[list["ListStatus"]] = relationship(
        back_populates="list_",
        lazy="raise",
        order_by="ListStatus.order_index",
    )
