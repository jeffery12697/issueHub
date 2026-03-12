import pytest

from tests.conftest import make_user, auth_headers
from app.models.workspace import WorkspaceMember, WorkspaceRole


async def make_task(client, list_, headers):
    r = await client.post(
        f"/api/v1/lists/{list_.id}/tasks",
        json={"title": "Task for comments"},
        headers=headers,
    )
    assert r.status_code == 201
    return r.json()


# ── happy path ────────────────────────────────────────────────────────────────

async def test_create_comment(client, list_, headers):
    task = await make_task(client, list_, headers)
    r = await client.post(
        f"/api/v1/tasks/{task['id']}/comments",
        json={"body": "This is a comment"},
        headers=headers,
    )
    assert r.status_code == 201
    data = r.json()
    assert data["body"] == "This is a comment"
    assert data["mentions"] == []
    assert data["parent_comment_id"] is None


async def test_list_comments_ordered_asc(client, list_, headers):
    task = await make_task(client, list_, headers)
    await client.post(f"/api/v1/tasks/{task['id']}/comments", json={"body": "first"}, headers=headers)
    await client.post(f"/api/v1/tasks/{task['id']}/comments", json={"body": "second"}, headers=headers)
    r = await client.get(f"/api/v1/tasks/{task['id']}/comments", headers=headers)
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 2
    assert data[0]["body"] == "first"
    assert data[1]["body"] == "second"


async def test_delete_comment(client, list_, headers):
    task = await make_task(client, list_, headers)
    create_r = await client.post(
        f"/api/v1/tasks/{task['id']}/comments", json={"body": "to delete"}, headers=headers
    )
    comment_id = create_r.json()["id"]

    del_r = await client.delete(
        f"/api/v1/tasks/{task['id']}/comments/{comment_id}", headers=headers
    )
    assert del_r.status_code == 204

    list_r = await client.get(f"/api/v1/tasks/{task['id']}/comments", headers=headers)
    assert list_r.json() == []


async def test_threaded_reply(client, list_, headers):
    task = await make_task(client, list_, headers)
    parent_r = await client.post(
        f"/api/v1/tasks/{task['id']}/comments", json={"body": "parent"}, headers=headers
    )
    parent_id = parent_r.json()["id"]

    reply_r = await client.post(
        f"/api/v1/tasks/{task['id']}/comments",
        json={"body": "reply", "parent_comment_id": parent_id},
        headers=headers,
    )
    assert reply_r.status_code == 201
    assert reply_r.json()["parent_comment_id"] == parent_id


# ── @mention ──────────────────────────────────────────────────────────────────

async def test_comment_resolves_mention(client, db, list_, user, headers):
    task = await make_task(client, list_, headers)
    # user.display_name is derived from email prefix by make_user helper (e.g. "user")
    r = await client.post(
        f"/api/v1/tasks/{task['id']}/comments",
        json={"body": f"hey @{user.display_name} check this"},
        headers=headers,
    )
    assert r.status_code == 201
    assert str(user.id) in r.json()["mentions"]


async def test_comment_no_mention(client, list_, headers):
    task = await make_task(client, list_, headers)
    r = await client.post(
        f"/api/v1/tasks/{task['id']}/comments",
        json={"body": "plain comment"},
        headers=headers,
    )
    assert r.json()["mentions"] == []


# ── auth / access control ─────────────────────────────────────────────────────

async def test_create_comment_unauthenticated(client, list_, headers):
    task = await make_task(client, list_, headers)
    r = await client.post(
        f"/api/v1/tasks/{task['id']}/comments", json={"body": "hi"}
    )
    assert r.status_code == 403


async def test_create_comment_non_member(client, db, list_, headers):
    task = await make_task(client, list_, headers)
    other = await make_user(db, email="outsider@example.com")
    r = await client.post(
        f"/api/v1/tasks/{task['id']}/comments",
        json={"body": "intruder"},
        headers=auth_headers(other),
    )
    assert r.status_code == 403


async def test_delete_comment_not_author(client, db, workspace, list_, headers):
    task = await make_task(client, list_, headers)
    create_r = await client.post(
        f"/api/v1/tasks/{task['id']}/comments", json={"body": "original"}, headers=headers
    )
    comment_id = create_r.json()["id"]

    other = await make_user(db, email="other@example.com")
    db.add(WorkspaceMember(workspace_id=workspace.id, user_id=other.id, role=WorkspaceRole.member))
    await db.flush()

    r = await client.delete(
        f"/api/v1/tasks/{task['id']}/comments/{comment_id}",
        headers=auth_headers(other),
    )
    assert r.status_code == 403


# ── side effects ──────────────────────────────────────────────────────────────

async def test_create_comment_writes_audit_log(client, list_, headers):
    task = await make_task(client, list_, headers)
    await client.post(
        f"/api/v1/tasks/{task['id']}/comments", json={"body": "audit me"}, headers=headers
    )
    audit_r = await client.get(f"/api/v1/tasks/{task['id']}/audit", headers=headers)
    actions = [e["action"] for e in audit_r.json()]
    assert "commented" in actions
