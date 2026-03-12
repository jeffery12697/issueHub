"""add custom fields tables

Revision ID: 0005
Revises: 0004
Create Date: 2026-03-12
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "custom_field_definitions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "list_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("lists.id"),
            nullable=False,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column(
            "field_type",
            sa.Enum("text", "number", "date", "dropdown", "checkbox", "url", name="fieldtype"),
            nullable=False,
        ),
        sa.Column("is_required", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("options_json", postgresql.JSONB(), nullable=True),
        sa.Column("order_index", sa.Float(), nullable=False, server_default="0.0"),
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
    op.create_index("ix_custom_field_definitions_list_id", "custom_field_definitions", ["list_id"])

    op.create_table(
        "custom_field_values",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "task_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tasks.id"),
            nullable=False,
        ),
        sa.Column(
            "field_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("custom_field_definitions.id"),
            nullable=False,
        ),
        sa.Column("value_text", sa.Text(), nullable=True),
        sa.Column("value_number", sa.Float(), nullable=True),
        sa.Column("value_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("value_boolean", sa.Boolean(), nullable=True),
        sa.Column("value_json", postgresql.JSONB(), nullable=True),
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
        sa.UniqueConstraint("task_id", "field_id", name="uq_custom_field_values_task_field"),
    )
    op.create_index("ix_custom_field_values_task_id", "custom_field_values", ["task_id"])
    op.create_index("ix_custom_field_values_field_id", "custom_field_values", ["field_id"])


def downgrade() -> None:
    op.drop_index("ix_custom_field_values_field_id", "custom_field_values")
    op.drop_index("ix_custom_field_values_task_id", "custom_field_values")
    op.drop_table("custom_field_values")
    op.drop_index("ix_custom_field_definitions_list_id", "custom_field_definitions")
    op.drop_table("custom_field_definitions")
    op.execute("DROP TYPE IF EXISTS fieldtype")
