"""Tests for AU-02: overdue task notifications."""
import pytest
from datetime import datetime, timedelta, timezone

from app.features.tasks.repository import TaskRepository
from app.models.task import Task
from sqlalchemy_utils.types.ltree import Ltree


async def _make_task(db, workspace, project, list_, user, due_date=None) -> Task:
    task = Task(
        title="Overdue test task",
        workspace_id=workspace.id,
        project_id=project.id,
        list_id=list_.id,
        reporter_id=user.id,
        assignee_ids=[user.id],
        order_index=1.0,
        depth=0,
        path=Ltree(str(user.id).replace("-", "_")),
        due_date=due_date,
    )
    db.add(task)
    await db.flush()
    return task


async def test_get_newly_overdue_returns_past_due_tasks(db, user, workspace, project, list_):
    """get_newly_overdue returns tasks with due_date in the past and overdue_notified=False."""
    past = datetime.now(timezone.utc) - timedelta(days=1)
    task = await _make_task(db, workspace, project, list_, user, due_date=past)
    await db.commit()

    repo = TaskRepository(db)
    overdue = await repo.get_newly_overdue()
    assert any(t.id == task.id for t in overdue)


async def test_get_newly_overdue_excludes_future_tasks(db, user, workspace, project, list_):
    """Tasks with future due_date are not included."""
    future = datetime.now(timezone.utc) + timedelta(days=2)
    await _make_task(db, workspace, project, list_, user, due_date=future)
    await db.commit()

    repo = TaskRepository(db)
    overdue = await repo.get_newly_overdue()
    assert len(overdue) == 0


async def test_get_newly_overdue_excludes_already_notified(db, user, workspace, project, list_):
    """Tasks with overdue_notified=True are excluded."""
    past = datetime.now(timezone.utc) - timedelta(days=1)
    task = await _make_task(db, workspace, project, list_, user, due_date=past)
    task.overdue_notified = True
    await db.commit()

    repo = TaskRepository(db)
    overdue = await repo.get_newly_overdue()
    assert not any(t.id == task.id for t in overdue)


async def test_mark_overdue_notified(db, user, workspace, project, list_):
    """mark_overdue_notified sets overdue_notified=True."""
    past = datetime.now(timezone.utc) - timedelta(days=1)
    task = await _make_task(db, workspace, project, list_, user, due_date=past)
    await db.commit()

    repo = TaskRepository(db)
    await repo.mark_overdue_notified(task.id)
    await db.commit()

    await db.refresh(task)
    assert task.overdue_notified is True


async def test_update_due_date_resets_overdue_notified(db, user, workspace, project, list_):
    """Updating due_date via the repository resets overdue_notified to False."""
    past = datetime.now(timezone.utc) - timedelta(days=1)
    task = await _make_task(db, workspace, project, list_, user, due_date=past)
    task.overdue_notified = True
    await db.commit()

    repo = TaskRepository(db)
    from app.features.tasks.schemas import UpdateTaskDTO, _UNSET
    future = datetime.now(timezone.utc) + timedelta(days=7)
    await repo.update(task, UpdateTaskDTO(due_date=future))
    await db.commit()

    await db.refresh(task)
    assert task.overdue_notified is False


async def test_tasks_without_due_date_excluded(db, user, workspace, project, list_):
    """Tasks with no due_date are never returned as overdue."""
    await _make_task(db, workspace, project, list_, user, due_date=None)
    await db.commit()

    repo = TaskRepository(db)
    overdue = await repo.get_newly_overdue()
    assert len(overdue) == 0
