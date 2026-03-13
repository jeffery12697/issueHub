"""add start_date and story_points to tasks

Revision ID: 0013
Revises: 0012
Create Date: 2026-03-13
"""
from alembic import op
import sqlalchemy as sa

revision = '0013'
down_revision = '0012'
branch_labels = None
depends_on = None

def upgrade():
    op.add_column('tasks', sa.Column('start_date', sa.DateTime(timezone=True), nullable=True))
    op.add_column('tasks', sa.Column('story_points', sa.Integer(), nullable=True))

def downgrade():
    op.drop_column('tasks', 'story_points')
    op.drop_column('tasks', 'start_date')
