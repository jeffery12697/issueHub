"""add epics table and epic_id on tasks (E-01)

Revision ID: 0025
Revises: 0024
Create Date: 2026-03-18
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "0025"
down_revision = "0024"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "epics",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("project_id", UUID(as_uuid=True), sa.ForeignKey("projects.id"), nullable=False, index=True),
        sa.Column("workspace_id", UUID(as_uuid=True), sa.ForeignKey("workspaces.id"), nullable=False, index=True),
        sa.Column("name", sa.String(500), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("color", sa.String(7), nullable=True),
        sa.Column(
            "status",
            sa.Enum("not_started", "in_progress", "done", name="epicstatus"),
            nullable=False,
            server_default="not_started",
        ),
        sa.Column("start_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("due_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("order_index", sa.Float, nullable=False, server_default="0.0"),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "tasks",
        sa.Column(
            "epic_id",
            UUID(as_uuid=True),
            sa.ForeignKey("epics.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index("ix_tasks_epic_id", "tasks", ["epic_id"])


def downgrade() -> None:
    op.drop_index("ix_tasks_epic_id", table_name="tasks")
    op.drop_column("tasks", "epic_id")
    op.drop_table("epics")
    op.execute("DROP TYPE epicstatus")
