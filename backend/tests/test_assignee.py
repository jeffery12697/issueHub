import pytest
from httpx import AsyncClient
from app.models.workspace import WorkspaceMember, WorkspaceRole
from tests.conftest import make_user, auth_headers


async def _make_task(client: AsyncClient, list_, headers: dict) -> dict:
    """Helper: create a task via HTTP and return its JSON."""
    resp = await client.post(
        f"/api/v1/lists/{list_.id}/tasks",
        json={"title": "Test task"},
        headers=headers,
    )
    assert resp.status_code == 201
    return resp.json()


async def test_set_assignee(client: AsyncClient, db, user, workspace, project, list_, headers):
    """PATCH /tasks/{id} with assignee_ids updates the task."""
    task = await _make_task(client, list_, headers)
    member2 = await make_user(db, "member2@example.com")
    db.add(WorkspaceMember(workspace_id=workspace.id, user_id=member2.id, role=WorkspaceRole.member))
    await db.commit()

    resp = await client.patch(
        f"/api/v1/tasks/{task['id']}",
        json={"assignee_ids": [str(member2.id)]},
        headers=headers,
    )
    assert resp.status_code == 200
    assert str(member2.id) in resp.json()["assignee_ids"]


async def test_clear_assignees(client: AsyncClient, db, user, workspace, project, list_, headers):
    """Sending assignee_ids=[] clears all assignees."""
    task = await _make_task(client, list_, headers)
    # Set an assignee first
    await client.patch(
        f"/api/v1/tasks/{task['id']}",
        json={"assignee_ids": [str(user.id)]},
        headers=headers,
    )
    # Now clear
    resp = await client.patch(
        f"/api/v1/tasks/{task['id']}",
        json={"assignee_ids": []},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["assignee_ids"] == []


async def test_set_reviewer(client: AsyncClient, db, user, workspace, project, list_, headers):
    """PATCH /tasks/{id} with reviewer_id sets the reviewer."""
    task = await _make_task(client, list_, headers)
    reviewer = await make_user(db, "reviewer@example.com")
    db.add(WorkspaceMember(workspace_id=workspace.id, user_id=reviewer.id, role=WorkspaceRole.member))
    await db.commit()

    resp = await client.patch(
        f"/api/v1/tasks/{task['id']}",
        json={"reviewer_id": str(reviewer.id)},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["reviewer_id"] == str(reviewer.id)


async def test_clear_reviewer(client: AsyncClient, db, user, workspace, project, list_, headers):
    """Sending reviewer_id=null clears the reviewer."""
    task = await _make_task(client, list_, headers)
    reviewer = await make_user(db, "reviewer2@example.com")
    db.add(WorkspaceMember(workspace_id=workspace.id, user_id=reviewer.id, role=WorkspaceRole.member))
    await db.commit()

    # Set reviewer first
    await client.patch(
        f"/api/v1/tasks/{task['id']}",
        json={"reviewer_id": str(reviewer.id)},
        headers=headers,
    )
    # Clear reviewer
    resp = await client.patch(
        f"/api/v1/tasks/{task['id']}",
        json={"reviewer_id": None},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["reviewer_id"] is None


async def test_my_tasks_empty(client: AsyncClient, db, user, workspace, project, list_, headers):
    """GET /workspaces/{id}/me/tasks returns empty when no tasks assigned."""
    resp = await client.get(
        f"/api/v1/workspaces/{workspace.id}/me/tasks",
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json() == []


async def test_my_tasks_returns_assigned(client: AsyncClient, db, user, workspace, project, list_, headers):
    """GET /workspaces/{id}/me/tasks returns tasks assigned to current user."""
    task = await _make_task(client, list_, headers)
    # Assign to self
    await client.patch(
        f"/api/v1/tasks/{task['id']}",
        json={"assignee_ids": [str(user.id)]},
        headers=headers,
    )

    resp = await client.get(
        f"/api/v1/workspaces/{workspace.id}/me/tasks",
        headers=headers,
    )
    assert resp.status_code == 200
    ids = [t["id"] for t in resp.json()]
    assert task["id"] in ids


async def test_my_tasks_excludes_unassigned(client: AsyncClient, db, user, workspace, project, list_, headers):
    """GET /workspaces/{id}/me/tasks does not return tasks not assigned to current user."""
    task = await _make_task(client, list_, headers)
    # Don't assign to self

    resp = await client.get(
        f"/api/v1/workspaces/{workspace.id}/me/tasks",
        headers=headers,
    )
    assert resp.status_code == 200
    ids = [t["id"] for t in resp.json()]
    assert task["id"] not in ids


async def test_my_tasks_not_member(client: AsyncClient, db, user, workspace, project, list_, headers):
    """Non-member cannot access my-tasks."""
    other = await make_user(db, "other@example.com")
    await db.commit()
    other_headers = auth_headers(other)

    resp = await client.get(
        f"/api/v1/workspaces/{workspace.id}/me/tasks",
        headers=other_headers,
    )
    assert resp.status_code == 403
