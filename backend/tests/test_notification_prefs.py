"""Tests for N-02: notification preferences (immediate vs digest)."""
import pytest
from uuid import UUID

from tests.conftest import make_user, auth_headers
from app.features.notifications.repository import NotificationRepository


async def test_default_preference_is_immediate(client, user, headers):
    """Newly created users default to immediate preference."""
    r = await client.get("/api/v1/auth/preferences", headers=headers)
    assert r.status_code == 200
    assert r.json()["notification_preference"] == "immediate"


async def test_update_preference_to_digest(client, user, headers):
    """PATCH /auth/preferences can switch to digest."""
    r = await client.patch(
        "/api/v1/auth/preferences",
        json={"notification_preference": "digest"},
        headers=headers,
    )
    assert r.status_code == 200
    assert r.json()["notification_preference"] == "digest"

    # Verify it persists
    r2 = await client.get("/api/v1/auth/preferences", headers=headers)
    assert r2.json()["notification_preference"] == "digest"


async def test_update_preference_back_to_immediate(client, user, headers):
    """PATCH can switch back to immediate."""
    await client.patch("/api/v1/auth/preferences", json={"notification_preference": "digest"}, headers=headers)
    r = await client.patch("/api/v1/auth/preferences", json={"notification_preference": "immediate"}, headers=headers)
    assert r.status_code == 200
    assert r.json()["notification_preference"] == "immediate"


async def test_invalid_preference_returns_422(client, user, headers):
    """Unknown preference value returns 422."""
    r = await client.patch(
        "/api/v1/auth/preferences",
        json={"notification_preference": "weekly"},
        headers=headers,
    )
    assert r.status_code == 422


async def test_get_unread_grouped_by_user_filters_by_digest(db, user, workspace, project, list_):
    """get_unread_grouped_by_user only returns users with preference=digest."""
    from app.models.task import Task
    from sqlalchemy_utils.types.ltree import Ltree

    # Create a task for the notification FK
    task = Task(
        title="T",
        workspace_id=workspace.id,
        project_id=project.id,
        list_id=list_.id,
        reporter_id=user.id,
        assignee_ids=[],
        order_index=1.0,
        depth=0,
        path=Ltree(str(user.id).replace("-", "_")),
    )
    db.add(task)
    await db.flush()

    notif_repo = NotificationRepository(db)
    await notif_repo.create(user_id=user.id, task_id=task.id, type_="mention", body="ping")
    await db.commit()

    # User has immediate preference — should NOT appear in digest results
    grouped = await notif_repo.get_unread_grouped_by_user(since_hours=24)
    assert user.id not in grouped

    # Change user to digest
    user.notification_preference = "digest"
    await db.commit()

    grouped2 = await notif_repo.get_unread_grouped_by_user(since_hours=24)
    assert user.id in grouped2
    assert len(grouped2[user.id]) == 1
