import pytest
from httpx import AsyncClient
from app.models.workspace import WorkspaceMember, WorkspaceRole
from tests.conftest import make_user, make_workspace, make_project, make_list, auth_headers


async def test_search_by_title(client: AsyncClient, db, user, workspace, project, list_, headers):
    await client.post(f"/api/v1/lists/{list_.id}/tasks", json={"title": "Fix login bug"}, headers=headers)
    await client.post(f"/api/v1/lists/{list_.id}/tasks", json={"title": "Refactor auth"}, headers=headers)

    r = await client.get(f"/api/v1/workspaces/{workspace.id}/search?q=login", headers=headers)
    assert r.status_code == 200
    results = r.json()
    assert len(results) == 1
    assert results[0]["title"] == "Fix login bug"


async def test_search_by_description(client: AsyncClient, db, user, workspace, project, list_, headers):
    await client.post(
        f"/api/v1/lists/{list_.id}/tasks",
        json={"title": "Some task", "description": "payment issue details"},
        headers=headers,
    )

    r = await client.get(f"/api/v1/workspaces/{workspace.id}/search?q=payment", headers=headers)
    assert r.status_code == 200
    results = r.json()
    assert len(results) == 1


async def test_search_empty_q_returns_empty(client: AsyncClient, db, user, workspace, project, list_, headers):
    await client.post(f"/api/v1/lists/{list_.id}/tasks", json={"title": "Some task"}, headers=headers)

    r = await client.get(f"/api/v1/workspaces/{workspace.id}/search?q=", headers=headers)
    assert r.status_code == 200
    assert r.json() == []


async def test_search_cross_workspace_isolation(client: AsyncClient, db, user, workspace, project, list_, headers):
    # Task in workspace A (already set up)
    await client.post(f"/api/v1/lists/{list_.id}/tasks", json={"title": "login task"}, headers=headers)

    # Create workspace B with a different user
    user_b = await make_user(db, "userb@example.com")
    ws_b = await make_workspace(db, user_b, "Workspace B")
    proj_b = await make_project(db, ws_b, "Project B")
    list_b = await make_list(db, proj_b, "List B")
    await db.commit()
    headers_b = auth_headers(user_b)

    await client.post(f"/api/v1/lists/{list_b.id}/tasks", json={"title": "login bug in B"}, headers=headers_b)

    # Search in workspace A should only return workspace A task
    r = await client.get(f"/api/v1/workspaces/{workspace.id}/search?q=login", headers=headers)
    assert r.status_code == 200
    results = r.json()
    assert all(t["workspace_id"] == str(workspace.id) for t in results)


async def test_search_non_member_forbidden(client: AsyncClient, db, user, workspace, project, list_, headers):
    other = await make_user(db, "other@example.com")
    await db.commit()
    other_headers = auth_headers(other)

    r = await client.get(f"/api/v1/workspaces/{workspace.id}/search?q=login", headers=other_headers)
    assert r.status_code == 403
