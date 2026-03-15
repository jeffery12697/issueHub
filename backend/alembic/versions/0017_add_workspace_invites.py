"""add workspace invites

Revision ID: 0017
Revises: 0016
Create Date: 2026-03-15
"""
from alembic import op
import sqlalchemy as sa

revision = "0017"
down_revision = "0016"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        CREATE TABLE workspace_invites (
            id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            workspace_id UUID NOT NULL REFERENCES workspaces(id),
            email       VARCHAR(255) NOT NULL,
            role        workspacerole NOT NULL DEFAULT 'member',
            token       VARCHAR(64) NOT NULL UNIQUE,
            invited_by  UUID NOT NULL REFERENCES users(id),
            expires_at  TIMESTAMPTZ NOT NULL,
            accepted_at TIMESTAMPTZ,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.create_index("ix_workspace_invites_workspace_id", "workspace_invites", ["workspace_id"])
    op.create_index("ix_workspace_invites_token", "workspace_invites", ["token"], unique=True)


def downgrade():
    op.drop_index("ix_workspace_invites_token", table_name="workspace_invites")
    op.drop_index("ix_workspace_invites_workspace_id", table_name="workspace_invites")
    op.drop_table("workspace_invites")
