"""add comments table

Revision ID: 0004
Revises: 0003
Create Date: 2026-03-12
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "comments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "task_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tasks.id"),
            nullable=False,
        ),
        sa.Column(
            "author_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=False,
        ),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column(
            "parent_comment_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("comments.id"),
            nullable=True,
        ),
        sa.Column(
            "mentions",
            postgresql.ARRAY(postgresql.UUID(as_uuid=True)),
            nullable=False,
            server_default="{}",
        ),
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
            nullable=False,
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_comments_task_id", "comments", ["task_id"])


def downgrade() -> None:
    op.drop_index("ix_comments_task_id", "comments")
    op.drop_table("comments")
