"""add automations table

Revision ID: 0015
Revises: 0014
Create Date: 2026-03-14
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0015'
down_revision = '0014'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'automations',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('list_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('lists.id'), nullable=False, index=True),
        sa.Column('trigger_type', sa.String(50), nullable=False),
        sa.Column('trigger_value', sa.String(255), nullable=False),
        sa.Column('action_type', sa.String(50), nullable=False),
        sa.Column('action_value', sa.String(255), nullable=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    )


def downgrade():
    op.drop_table('automations')
