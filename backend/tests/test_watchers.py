"""Tests for task watchers (N-01) and watcher notifications."""
import pytest
from httpx import AsyncClient

from tests.conftest import make_user, auth_headers
from app.models.workspace import WorkspaceMember, WorkspaceRole


async def make_task(client: AsyncClient, list_, headers: dict) -> dict:
    r = await client.post(
        f"/api/v1/lists/{list_.id}/tasks",
        json={"title": "Watcher Test Task"},
        headers=headers,
    )
    assert r.status_code == 201
    return r.json()


# ── watch / unwatch ───────────────────────────────────────────────────────────


async def test_watch_status_default_false(client: AsyncClient, user, list_, headers):
    """A user is not watching a task by default."""
    task = await make_task(client, list_, headers)
    resp = await client.get(f"/api/v1/tasks/{task['id']}/watch", headers=headers)
    assert resp.status_code == 200
    assert resp.json() == {"watching": False}


async def test_watch_task(client: AsyncClient, user, list_, headers):
    """POST /watch sets watching=True."""
    task = await make_task(client, list_, headers)
    r = await client.post(f"/api/v1/tasks/{task['id']}/watch", headers=headers)
    assert r.status_code == 204

    resp = await client.get(f"/api/v1/tasks/{task['id']}/watch", headers=headers)
    assert resp.json() == {"watching": True}


async def test_unwatch_task(client: AsyncClient, user, list_, headers):
    """DELETE /watch sets watching=False."""
    task = await make_task(client, list_, headers)
    await client.post(f"/api/v1/tasks/{task['id']}/watch", headers=headers)
    r = await client.delete(f"/api/v1/tasks/{task['id']}/watch", headers=headers)
    assert r.status_code == 204

    resp = await client.get(f"/api/v1/tasks/{task['id']}/watch", headers=headers)
    assert resp.json() == {"watching": False}


async def test_watch_idempotent(client: AsyncClient, user, list_, headers):
    """Watching twice does not create duplicate rows or error."""
    task = await make_task(client, list_, headers)
    await client.post(f"/api/v1/tasks/{task['id']}/watch", headers=headers)
    r = await client.post(f"/api/v1/tasks/{task['id']}/watch", headers=headers)
    assert r.status_code == 204

    resp = await client.get(f"/api/v1/tasks/{task['id']}/watch", headers=headers)
    assert resp.json() == {"watching": True}


# ── watcher notifications ─────────────────────────────────────────────────────


async def test_watcher_notified_on_task_update(client: AsyncClient, db, user, workspace, project, list_, headers):
    """A watcher receives a notification when the task is updated."""
    # Second user watches the task
    watcher = await make_user(db, email="watcher@example.com")
    db.add(WorkspaceMember(workspace_id=workspace.id, user_id=watcher.id, role=WorkspaceRole.member))
    await db.commit()
    watcher_headers = auth_headers(watcher)

    task = await make_task(client, list_, headers)
    await client.post(f"/api/v1/tasks/{task['id']}/watch", headers=watcher_headers)

    # Actor updates the task
    r = await client.patch(
        f"/api/v1/tasks/{task['id']}",
        json={"title": "Updated Title"},
        headers=headers,
    )
    assert r.status_code == 200

    # Watcher should have a notification
    notifs = await client.get("/api/v1/users/me/notifications", headers=watcher_headers)
    assert notifs.status_code == 200
    bodies = [n["body"] for n in notifs.json()]
    assert any("updated" in b for b in bodies)


async def test_watcher_notified_on_comment(client: AsyncClient, db, user, workspace, project, list_, headers):
    """A watcher receives a notification when someone comments on the task."""
    watcher = await make_user(db, email="watcher2@example.com")
    db.add(WorkspaceMember(workspace_id=workspace.id, user_id=watcher.id, role=WorkspaceRole.member))
    await db.commit()
    watcher_headers = auth_headers(watcher)

    task = await make_task(client, list_, headers)
    await client.post(f"/api/v1/tasks/{task['id']}/watch", headers=watcher_headers)

    await client.post(
        f"/api/v1/tasks/{task['id']}/comments",
        json={"body": "Here is a comment"},
        headers=headers,
    )

    notifs = await client.get("/api/v1/users/me/notifications", headers=watcher_headers)
    assert notifs.status_code == 200
    bodies = [n["body"] for n in notifs.json()]
    assert any("commented" in b for b in bodies)


async def test_actor_not_notified_on_own_update(client: AsyncClient, user, list_, headers):
    """The actor who updates a task does not receive a watcher notification."""
    task = await make_task(client, list_, headers)
    # Actor watches their own task
    await client.post(f"/api/v1/tasks/{task['id']}/watch", headers=headers)

    await client.patch(f"/api/v1/tasks/{task['id']}", json={"title": "Self Update"}, headers=headers)

    notifs = await client.get("/api/v1/users/me/notifications", headers=headers)
    task_update_notifs = [n for n in notifs.json() if n["type"] == "task_updated"]
    assert len(task_update_notifs) == 0


async def test_assignee_notified_on_assignment(client: AsyncClient, db, user, workspace, project, list_, headers):
    """A user receives an 'assigned' notification when added as assignee."""
    assignee = await make_user(db, email="assignee@example.com")
    db.add(WorkspaceMember(workspace_id=workspace.id, user_id=assignee.id, role=WorkspaceRole.member))
    await db.commit()
    assignee_headers = auth_headers(assignee)

    task = await make_task(client, list_, headers)
    await client.patch(
        f"/api/v1/tasks/{task['id']}",
        json={"assignee_ids": [str(assignee.id)]},
        headers=headers,
    )

    notifs = await client.get("/api/v1/users/me/notifications", headers=assignee_headers)
    assert notifs.status_code == 200
    assigned_notifs = [n for n in notifs.json() if n["type"] == "assigned"]
    assert len(assigned_notifs) == 1
    assert "assigned you" in assigned_notifs[0]["body"]
