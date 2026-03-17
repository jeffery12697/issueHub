"""add status_mappings table for cross-list status mapping rules (S-04)

Revision ID: 0024
Revises: 0023
Create Date: 2026-03-17
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "0024"
down_revision = "0023"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "status_mappings",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("project_id", UUID(as_uuid=True), sa.ForeignKey("projects.id"), nullable=False, index=True),
        sa.Column("from_list_id", UUID(as_uuid=True), sa.ForeignKey("lists.id"), nullable=False),
        sa.Column("from_status_id", UUID(as_uuid=True), sa.ForeignKey("list_statuses.id"), nullable=False),
        sa.Column("to_list_id", UUID(as_uuid=True), sa.ForeignKey("lists.id"), nullable=False),
        sa.Column("to_status_id", UUID(as_uuid=True), sa.ForeignKey("list_statuses.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.UniqueConstraint("from_list_id", "to_list_id", "from_status_id", name="uq_status_mapping_from_to"),
    )


def downgrade() -> None:
    op.drop_table("status_mappings")
