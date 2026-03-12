from uuid import uuid4

from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class ListTemplate(Base, TimestampMixin):
    __tablename__ = "list_templates"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    workspace_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workspaces.id"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    default_statuses: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    default_custom_fields: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
