"""Tests for the notifications feature."""
import pytest
from uuid import UUID
from httpx import AsyncClient

from tests.conftest import make_user, auth_headers
from app.features.notifications.repository import NotificationRepository
from app.models.workspace import WorkspaceMember, WorkspaceRole


async def make_task(client: AsyncClient, list_, headers: dict) -> dict:
    r = await client.post(
        f"/api/v1/lists/{list_.id}/tasks",
        json={"title": "Notification Test Task"},
        headers=headers,
    )
    assert r.status_code == 201
    return r.json()


# ── tests ────────────────────────────────────────────────────────────────────


async def test_list_notifications_empty(client: AsyncClient, user, headers):
    """Empty list returned when user has no notifications."""
    resp = await client.get("/api/v1/users/me/notifications", headers=headers)
    assert resp.status_code == 200
    assert resp.json() == []


async def test_unread_count_zero_initially(client: AsyncClient, user, headers):
    """Unread count is 0 for a fresh user."""
    resp = await client.get("/api/v1/users/me/notifications/unread-count", headers=headers)
    assert resp.status_code == 200
    assert resp.json() == {"count": 0}


async def test_mention_creates_notification(client: AsyncClient, db, user, workspace, project, list_, headers):
    """Posting a comment with @mention creates a notification for the mentioned user."""
    # Create a second user to be mentioned
    mentioned = await make_user(db, "mentioned@example.com")
    db.add(WorkspaceMember(workspace_id=workspace.id, user_id=mentioned.id, role=WorkspaceRole.member))
    await db.commit()

    # Create a task and post a comment mentioning the other user
    task = await make_task(client, list_, headers)
    resp = await client.post(
        f"/api/v1/tasks/{task['id']}/comments",
        json={"body": f"Hey @{mentioned.display_name} please review this"},
        headers=headers,
    )
    assert resp.status_code == 201

    # Verify the mentioned user received a notification
    notif_repo = NotificationRepository(db)
    notifs = await notif_repo.list_for_user(mentioned.id)
    assert len(notifs) == 1
    assert notifs[0].type == "mention"
    assert "mentioned you" in notifs[0].body
    assert notifs[0].is_read is False
    assert str(notifs[0].task_id) == task["id"]


async def test_mark_notification_read(client: AsyncClient, db, user, workspace, project, list_, headers):
    """Marking a notification read sets is_read=True."""
    task = await make_task(client, list_, headers)
    task_id = UUID(task["id"])

    notif_repo = NotificationRepository(db)
    notif = await notif_repo.create(
        user_id=user.id,
        task_id=task_id,
        type_="mention",
        body="Someone mentioned you",
    )
    await db.commit()

    resp = await client.patch(
        f"/api/v1/users/me/notifications/{notif.id}/read",
        headers=headers,
    )
    assert resp.status_code == 204

    await db.refresh(notif)
    assert notif.is_read is True


async def test_unread_count_after_notification(client: AsyncClient, db, user, workspace, project, list_, headers):
    """Unread count reflects the number of unread notifications."""
    task = await make_task(client, list_, headers)
    task_id = UUID(task["id"])

    notif_repo = NotificationRepository(db)
    await notif_repo.create(user_id=user.id, task_id=task_id, type_="mention", body="Ping 1")
    await notif_repo.create(user_id=user.id, task_id=task_id, type_="mention", body="Ping 2")
    await db.commit()

    resp = await client.get("/api/v1/users/me/notifications/unread-count", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["count"] == 2


async def test_mark_all_read(client: AsyncClient, db, user, workspace, project, list_, headers):
    """Mark-all-read sets all notifications to is_read=True."""
    task = await make_task(client, list_, headers)
    task_id = UUID(task["id"])

    notif_repo = NotificationRepository(db)
    await notif_repo.create(user_id=user.id, task_id=task_id, type_="mention", body="Ping 1")
    await notif_repo.create(user_id=user.id, task_id=task_id, type_="mention", body="Ping 2")
    await db.commit()

    resp = await client.patch("/api/v1/users/me/notifications/read-all", headers=headers)
    assert resp.status_code == 204

    count_resp = await client.get("/api/v1/users/me/notifications/unread-count", headers=headers)
    assert count_resp.json()["count"] == 0


async def test_notifications_only_visible_to_owner(client: AsyncClient, db, user, workspace, project, list_, headers):
    """A notification for user A is not visible to user B."""
    other = await make_user(db, "other@example.com")
    await db.commit()

    task = await make_task(client, list_, headers)
    task_id = UUID(task["id"])

    notif_repo = NotificationRepository(db)
    await notif_repo.create(user_id=user.id, task_id=task_id, type_="mention", body="For user A only")
    await db.commit()

    other_headers = auth_headers(other)
    resp = await client.get("/api/v1/users/me/notifications", headers=other_headers)
    assert resp.status_code == 200
    assert resp.json() == []
