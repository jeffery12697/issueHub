"""add is_default to saved_views

Revision ID: 0032
Revises: 0031
Create Date: 2026-03-19
"""
import sqlalchemy as sa
from alembic import op

revision = "0032"
down_revision = "0031"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "saved_views",
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default="false"),
    )


def downgrade() -> None:
    op.drop_column("saved_views", "is_default")
