"""add time_entries table

Revision ID: 0014
Revises: 0013
Create Date: 2026-03-13
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0014'
down_revision = '0013'
branch_labels = None
depends_on = None

def upgrade():
    op.create_table(
        'time_entries',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('task_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tasks.id'), nullable=False, index=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('duration_minutes', sa.Integer(), nullable=False),
        sa.Column('note', sa.Text(), nullable=True),
        sa.Column('logged_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

def downgrade():
    op.drop_table('time_entries')
