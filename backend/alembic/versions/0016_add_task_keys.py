"""add task keys

Revision ID: 0016
Revises: 0015
Create Date: 2026-03-14
"""
import re
from alembic import op
import sqlalchemy as sa

revision = "0016"
down_revision = "0015"
branch_labels = None
depends_on = None


def _make_prefix(name: str) -> str:
    """Generate a short uppercase prefix from a project name.

    Multi-word: first letter of each word, up to 4 chars.
    Single word: first 4 uppercase letters.
    """
    clean = re.sub(r"[^A-Za-z0-9 ]", "", name).upper()
    words = clean.split()
    if len(words) > 1:
        prefix = "".join(w[0] for w in words if w)[:4]
    else:
        prefix = re.sub(r"[^A-Z]", "", clean)[:4]
    return prefix or "TSK"


def upgrade():
    # Add columns
    op.add_column("projects", sa.Column("task_prefix", sa.String(10), nullable=True))
    op.add_column("projects", sa.Column("next_task_number", sa.Integer(), nullable=True))
    op.add_column("tasks", sa.Column("task_number", sa.Integer(), nullable=True))
    op.add_column("tasks", sa.Column("task_key", sa.String(20), nullable=True))

    # Populate existing data
    conn = op.get_bind()
    projects = conn.execute(
        sa.text("SELECT id, name FROM projects WHERE deleted_at IS NULL")
    ).fetchall()

    for project in projects:
        prefix = _make_prefix(project.name)
        conn.execute(
            sa.text("UPDATE projects SET task_prefix = :prefix WHERE id = :id"),
            {"prefix": prefix, "id": project.id},
        )
        tasks = conn.execute(
            sa.text(
                "SELECT id FROM tasks WHERE project_id = :pid "
                "ORDER BY created_at ASC NULLS LAST"
            ),
            {"pid": project.id},
        ).fetchall()
        for i, task in enumerate(tasks, 1):
            key = f"{prefix}-{i:04d}"
            conn.execute(
                sa.text(
                    "UPDATE tasks SET task_number = :num, task_key = :key WHERE id = :id"
                ),
                {"num": i, "key": key, "id": task.id},
            )
        conn.execute(
            sa.text(
                "UPDATE projects SET next_task_number = :n WHERE id = :id"
            ),
            {"n": len(tasks) + 1, "id": project.id},
        )

    # Set defaults for any remaining nulls (deleted projects / no tasks)
    conn.execute(
        sa.text("UPDATE projects SET task_prefix = 'TSK' WHERE task_prefix IS NULL")
    )
    conn.execute(
        sa.text("UPDATE projects SET next_task_number = 1 WHERE next_task_number IS NULL")
    )

    # Now make the columns non-nullable and add the index
    op.alter_column("projects", "task_prefix", nullable=False)
    op.alter_column("projects", "next_task_number", nullable=False)
    op.create_index("ix_tasks_task_key", "tasks", ["task_key"])


def downgrade():
    op.drop_index("ix_tasks_task_key", table_name="tasks")
    op.drop_column("tasks", "task_key")
    op.drop_column("tasks", "task_number")
    op.drop_column("projects", "next_task_number")
    op.drop_column("projects", "task_prefix")
