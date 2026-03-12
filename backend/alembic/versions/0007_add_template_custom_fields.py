"""add default_custom_fields to list_templates

Revision ID: 0007
Revises: 0006
Create Date: 2026-03-12
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "list_templates",
        sa.Column(
            "default_custom_fields",
            postgresql.JSONB(),
            nullable=False,
            server_default="[]",
        ),
    )


def downgrade() -> None:
    op.drop_column("list_templates", "default_custom_fields")
