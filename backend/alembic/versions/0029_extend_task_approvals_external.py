"""extend task_approvals for external (GitHub/GitLab webhook) approvals

Revision ID: 0029
Revises: 0028
Create Date: 2026-03-18
"""
import sqlalchemy as sa
from alembic import op

revision = "0029"
down_revision = "0028"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Make user_id nullable (external approvals have no IssueHub user)
    op.alter_column("task_approvals", "user_id", nullable=True)

    # Add new columns
    op.add_column("task_approvals", sa.Column("source", sa.String(32), nullable=False, server_default="internal"))
    op.add_column("task_approvals", sa.Column("external_name", sa.String(255), nullable=True))
    op.add_column("task_approvals", sa.Column("external_email", sa.String(255), nullable=True))

    # Drop old blanket unique constraint (doesn't work with NULLable user_id)
    op.drop_constraint("uq_task_approval", "task_approvals")

    # Partial unique index for internal approvals (user_id NOT NULL)
    op.create_index(
        "uq_task_approval_internal",
        "task_approvals",
        ["task_id", "user_id"],
        unique=True,
        postgresql_where=sa.text("user_id IS NOT NULL"),
    )
    # Partial unique index for external approvals (user_id IS NULL)
    op.create_index(
        "uq_task_approval_external",
        "task_approvals",
        ["task_id", "source", "external_name"],
        unique=True,
        postgresql_where=sa.text("user_id IS NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_task_approval_external", "task_approvals")
    op.drop_index("uq_task_approval_internal", "task_approvals")
    op.drop_column("task_approvals", "external_email")
    op.drop_column("task_approvals", "external_name")
    op.drop_column("task_approvals", "source")
    op.alter_column("task_approvals", "user_id", nullable=False)
    op.create_unique_constraint("uq_task_approval", "task_approvals", ["task_id", "user_id"])
