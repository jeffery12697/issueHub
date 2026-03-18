"""Tests for workspace tags and task tag assignments."""
import pytest
from tests.conftest import make_user, auth_headers, make_task


# --- Workspace tag CRUD ---

async def test_create_tag(client, workspace, headers):
    r = await client.post(
        f"/api/v1/workspaces/{workspace.id}/tags",
        json={"name": "bug", "color": "#ef4444"},
        headers=headers,
    )
    assert r.status_code == 201
    data = r.json()
    assert data["name"] == "bug"
    assert data["color"] == "#ef4444"
    assert data["workspace_id"] == str(workspace.id)


async def test_create_tag_default_color(client, workspace, headers):
    r = await client.post(
        f"/api/v1/workspaces/{workspace.id}/tags",
        json={"name": "feature"},
        headers=headers,
    )
    assert r.status_code == 201
    assert r.json()["color"] == "#6B7280"


async def test_list_tags(client, workspace, headers):
    await client.post(f"/api/v1/workspaces/{workspace.id}/tags", json={"name": "alpha"}, headers=headers)
    await client.post(f"/api/v1/workspaces/{workspace.id}/tags", json={"name": "beta"}, headers=headers)
    r = await client.get(f"/api/v1/workspaces/{workspace.id}/tags", headers=headers)
    assert r.status_code == 200
    names = [t["name"] for t in r.json()]
    assert "alpha" in names
    assert "beta" in names


async def test_update_tag(client, workspace, headers):
    created = (await client.post(
        f"/api/v1/workspaces/{workspace.id}/tags",
        json={"name": "old", "color": "#aaaaaa"},
        headers=headers,
    )).json()
    r = await client.patch(
        f"/api/v1/workspaces/{workspace.id}/tags/{created['id']}",
        json={"name": "new", "color": "#bbbbbb"},
        headers=headers,
    )
    assert r.status_code == 200
    assert r.json()["name"] == "new"
    assert r.json()["color"] == "#bbbbbb"


async def test_delete_tag(client, workspace, headers):
    created = (await client.post(
        f"/api/v1/workspaces/{workspace.id}/tags",
        json={"name": "to-delete"},
        headers=headers,
    )).json()
    r = await client.delete(
        f"/api/v1/workspaces/{workspace.id}/tags/{created['id']}",
        headers=headers,
    )
    assert r.status_code == 204
    ids = [t["id"] for t in (await client.get(f"/api/v1/workspaces/{workspace.id}/tags", headers=headers)).json()]
    assert created["id"] not in ids


async def test_non_admin_cannot_create_tag(client, workspace, db, headers):
    member = await make_user(db, email="member@example.com")
    from app.models.workspace import WorkspaceMember, WorkspaceRole
    db.add(WorkspaceMember(workspace_id=workspace.id, user_id=member.id, role=WorkspaceRole.member))
    await db.flush()
    r = await client.post(
        f"/api/v1/workspaces/{workspace.id}/tags",
        json={"name": "forbidden"},
        headers=auth_headers(member),
    )
    assert r.status_code == 403


async def test_member_can_list_tags(client, workspace, db, headers):
    await client.post(f"/api/v1/workspaces/{workspace.id}/tags", json={"name": "visible"}, headers=headers)
    member = await make_user(db, email="reader@example.com")
    from app.models.workspace import WorkspaceMember, WorkspaceRole
    db.add(WorkspaceMember(workspace_id=workspace.id, user_id=member.id, role=WorkspaceRole.member))
    await db.flush()
    r = await client.get(f"/api/v1/workspaces/{workspace.id}/tags", headers=auth_headers(member))
    assert r.status_code == 200
    assert any(t["name"] == "visible" for t in r.json())


# --- Task tag assignments ---

async def test_add_tag_to_task(client, workspace, list_, headers):
    task = await make_task(client, list_, headers)
    tag = (await client.post(
        f"/api/v1/workspaces/{workspace.id}/tags",
        json={"name": "urgent"},
        headers=headers,
    )).json()

    r = await client.post(
        f"/api/v1/tasks/{task['id']}/tags",
        json={"tag_id": tag["id"]},
        headers=headers,
    )
    assert r.status_code == 201
    assert r.json()["id"] == tag["id"]


async def test_add_tag_idempotent(client, workspace, list_, headers):
    """Adding the same tag twice returns 201 but doesn't create duplicate."""
    task = await make_task(client, list_, headers)
    tag = (await client.post(
        f"/api/v1/workspaces/{workspace.id}/tags", json={"name": "dup"}, headers=headers
    )).json()
    await client.post(f"/api/v1/tasks/{task['id']}/tags", json={"tag_id": tag["id"]}, headers=headers)
    r2 = await client.post(f"/api/v1/tasks/{task['id']}/tags", json={"tag_id": tag["id"]}, headers=headers)
    assert r2.status_code == 201

    tags_r = await client.get(f"/api/v1/tasks/{task['id']}/tags", headers=headers)
    assert len([t for t in tags_r.json() if t["id"] == tag["id"]]) == 1


async def test_list_task_tags(client, workspace, list_, headers):
    task = await make_task(client, list_, headers)
    tag1 = (await client.post(f"/api/v1/workspaces/{workspace.id}/tags", json={"name": "t1"}, headers=headers)).json()
    tag2 = (await client.post(f"/api/v1/workspaces/{workspace.id}/tags", json={"name": "t2"}, headers=headers)).json()
    await client.post(f"/api/v1/tasks/{task['id']}/tags", json={"tag_id": tag1["id"]}, headers=headers)
    await client.post(f"/api/v1/tasks/{task['id']}/tags", json={"tag_id": tag2["id"]}, headers=headers)
    r = await client.get(f"/api/v1/tasks/{task['id']}/tags", headers=headers)
    assert r.status_code == 200
    names = [t["name"] for t in r.json()]
    assert "t1" in names and "t2" in names


async def test_remove_tag_from_task(client, workspace, list_, headers):
    task = await make_task(client, list_, headers)
    tag = (await client.post(
        f"/api/v1/workspaces/{workspace.id}/tags", json={"name": "removeme"}, headers=headers
    )).json()
    await client.post(f"/api/v1/tasks/{task['id']}/tags", json={"tag_id": tag["id"]}, headers=headers)
    r = await client.delete(f"/api/v1/tasks/{task['id']}/tags/{tag['id']}", headers=headers)
    assert r.status_code == 204
    remaining = await client.get(f"/api/v1/tasks/{task['id']}/tags", headers=headers)
    assert not any(t["id"] == tag["id"] for t in remaining.json())


async def test_task_response_includes_tag_ids(client, workspace, list_, headers):
    """GET /tasks/{id} should return tag_ids in the response."""
    task = await make_task(client, list_, headers)
    tag = (await client.post(
        f"/api/v1/workspaces/{workspace.id}/tags", json={"name": "included"}, headers=headers
    )).json()
    await client.post(f"/api/v1/tasks/{task['id']}/tags", json={"tag_id": tag["id"]}, headers=headers)
    r = await client.get(f"/api/v1/tasks/{task['id']}", headers=headers)
    assert r.status_code == 200
    assert tag["id"] in r.json()["tag_ids"]


async def test_list_tasks_filter_by_tag(client, workspace, list_, headers):
    """Tasks can be filtered by tag_ids."""
    task_a = await make_task(client, list_, headers, title="Task A")
    task_b = await make_task(client, list_, headers, title="Task B")
    tag = (await client.post(
        f"/api/v1/workspaces/{workspace.id}/tags", json={"name": "filter-me"}, headers=headers
    )).json()
    await client.post(f"/api/v1/tasks/{task_a['id']}/tags", json={"tag_id": tag["id"]}, headers=headers)
    r = await client.get(
        f"/api/v1/lists/{list_.id}/tasks",
        params={"tag_ids": tag["id"]},
        headers=headers,
    )
    assert r.status_code == 200
    ids = [t["id"] for t in r.json()]
    assert task_a["id"] in ids
    assert task_b["id"] not in ids


async def test_cross_workspace_tag_rejected(client, workspace, list_, headers, db):
    """Cannot assign a tag from another workspace to a task."""
    from tests.conftest import make_workspace, make_user
    other_user = await make_user(db, email="other@example.com")
    other_ws = await make_workspace(db, other_user)
    other_headers = auth_headers(other_user)
    other_tag = (await client.post(
        f"/api/v1/workspaces/{other_ws.id}/tags",
        json={"name": "foreign"},
        headers=other_headers,
    )).json()

    task = await make_task(client, list_, headers)
    r = await client.post(
        f"/api/v1/tasks/{task['id']}/tags",
        json={"tag_id": other_tag["id"]},
        headers=headers,
    )
    assert r.status_code == 404
