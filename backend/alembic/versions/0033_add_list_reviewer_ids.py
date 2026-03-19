"""add reviewer_ids to lists

Revision ID: 0033
Revises: 0032
Create Date: 2026-03-19
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import ARRAY, UUID

revision = "0033"
down_revision = "0032"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "lists",
        sa.Column(
            "reviewer_ids",
            ARRAY(UUID(as_uuid=True)),
            nullable=False,
            server_default="{}",
        ),
    )


def downgrade() -> None:
    op.drop_column("lists", "reviewer_ids")
