"""add task_git_links table

Revision ID: 0027
Revises: 0026
Create Date: 2026-03-18
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "0027"
down_revision = "0026"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "task_git_links",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "task_id",
            UUID(as_uuid=True),
            sa.ForeignKey("tasks.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("platform", sa.String(32), nullable=False),
        sa.Column("repo", sa.String(500), nullable=False),
        sa.Column("pr_number", sa.Integer, nullable=True),
        sa.Column("pr_title", sa.String(500), nullable=True),
        sa.Column("pr_url", sa.String(1000), nullable=True),
        sa.Column("branch", sa.String(500), nullable=False),
        sa.Column("status", sa.String(32), nullable=False, server_default="open"),
        sa.Column("linked_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("merged_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint("task_id", "platform", "repo", "pr_number", name="uq_task_git_link"),
    )


def downgrade() -> None:
    op.drop_table("task_git_links")
