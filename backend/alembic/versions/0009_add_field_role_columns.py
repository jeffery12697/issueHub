"""add visibility_roles and editable_roles to custom_field_definitions

Revision ID: 0009
Revises: 0008
Create Date: 2026-03-13
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0009'
down_revision = '0008'
branch_labels = None
depends_on = None

def upgrade():
    op.add_column('custom_field_definitions',
        sa.Column('visibility_roles', postgresql.ARRAY(sa.Text()), nullable=False, server_default='{}'))
    op.add_column('custom_field_definitions',
        sa.Column('editable_roles', postgresql.ARRAY(sa.Text()), nullable=False, server_default='{}'))

def downgrade():
    op.drop_column('custom_field_definitions', 'editable_roles')
    op.drop_column('custom_field_definitions', 'visibility_roles')
