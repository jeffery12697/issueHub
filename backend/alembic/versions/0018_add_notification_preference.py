"""add notification_preference to users

Revision ID: 0018
Revises: 0017
Create Date: 2026-03-15
"""
from alembic import op
import sqlalchemy as sa

revision = "0018"
down_revision = "0017"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "users",
        sa.Column(
            "notification_preference",
            sa.String(20),
            nullable=False,
            server_default="immediate",
        ),
    )


def downgrade():
    op.drop_column("users", "notification_preference")
