"""add overdue_notified to tasks

Revision ID: 0019
Revises: 0018
Create Date: 2026-03-15
"""
from alembic import op
import sqlalchemy as sa

revision = "0019"
down_revision = "0018"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "tasks",
        sa.Column(
            "overdue_notified",
            sa.Boolean(),
            nullable=False,
            server_default="false",
        ),
    )


def downgrade():
    op.drop_column("tasks", "overdue_notified")
