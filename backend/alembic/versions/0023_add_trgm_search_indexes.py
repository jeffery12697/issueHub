"""add pg_trgm extension and trigram indexes for fast ILIKE search

Revision ID: 0023
Revises: 0022
Create Date: 2026-03-17

GIN trigram indexes allow PostgreSQL to use an index for %pattern% ILIKE queries
instead of doing a full sequential scan. Requires the pg_trgm extension.

For zero-downtime production deploys on large existing tables, run the three
CREATE INDEX statements manually with CONCURRENTLY before applying this migration.
"""
from alembic import op

revision = "0023"
down_revision = "0022"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")

    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_tasks_title_trgm "
        "ON tasks USING GIN (title gin_trgm_ops)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_tasks_task_key_trgm "
        "ON tasks USING GIN (task_key gin_trgm_ops)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_comments_body_trgm "
        "ON comments USING GIN (body gin_trgm_ops)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_tasks_title_trgm")
    op.execute("DROP INDEX IF EXISTS ix_tasks_task_key_trgm")
    op.execute("DROP INDEX IF EXISTS ix_comments_body_trgm")
