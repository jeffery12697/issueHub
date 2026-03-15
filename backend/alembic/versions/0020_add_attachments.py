"""add attachments table

Revision ID: 0020
Revises: 0019
Create Date: 2026-03-15
"""
from alembic import op

revision = "0020"
down_revision = "0019"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        CREATE TABLE attachments (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
            comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
            uploaded_by UUID NOT NULL REFERENCES users(id),
            filename VARCHAR(255) NOT NULL,
            s3_key VARCHAR(512) NOT NULL UNIQUE,
            size INTEGER NOT NULL,
            mime_type VARCHAR(127) NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX ix_attachments_task_id ON attachments (task_id)")
    op.execute("CREATE INDEX ix_attachments_comment_id ON attachments (comment_id)")


def downgrade():
    op.execute("DROP TABLE IF EXISTS attachments")
