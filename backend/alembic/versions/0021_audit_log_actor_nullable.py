"""make audit_logs.actor_id nullable for system-generated events (e.g. git webhook)

Revision ID: 0021
Revises: 0020
Create Date: 2026-03-16
"""
from alembic import op

revision = "0021"
down_revision = "0020"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("audit_logs", "actor_id", nullable=True)


def downgrade() -> None:
    # Re-filling NULLs is not safe automatically; this just restores the constraint
    # if no NULL rows exist.
    op.alter_column("audit_logs", "actor_id", nullable=False)
