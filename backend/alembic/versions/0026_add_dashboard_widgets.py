"""add dashboard_widgets table (R-01)

Revision ID: 0026
Revises: 0025
Create Date: 2026-03-18
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = "0026"
down_revision = "0025"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "dashboard_widgets",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "workspace_id",
            UUID(as_uuid=True),
            sa.ForeignKey("workspaces.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "widget_type",
            sa.Enum(
                "completion_rate",
                "overdue_count",
                "member_workload",
                name="widgettype",
            ),
            nullable=False,
        ),
        sa.Column("config", JSONB, nullable=False, server_default="{}"),
        sa.Column("order_index", sa.Integer, nullable=False, server_default="0"),
        sa.Column(
            "visible_to_members", sa.Boolean, nullable=False, server_default="false"
        ),
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
            onupdate=sa.func.now(),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_table("dashboard_widgets")
    op.execute("DROP TYPE IF EXISTS widgettype")
