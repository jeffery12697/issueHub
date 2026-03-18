"""
Tests for Epic CRUD (E-01) and task epic_id assignment (E-02).
"""
import pytest
from httpx import AsyncClient

from tests.conftest import make_user, make_workspace, make_project, make_list, auth_headers, make_task


# ── helpers ───────────────────────────────────────────────────────────────────

async def make_epic(client: AsyncClient, project, headers: dict, name: str = "Test Epic") -> dict:
    resp = await client.post(
        f"/api/v1/projects/{project.id}/epics",
        json={"name": name},
        headers=headers,
    )
    assert resp.status_code == 201
    return resp.json()


# ── E-01: Epic CRUD ───────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_epic(client, project, headers):
    resp = await client.post(
        f"/api/v1/projects/{project.id}/epics",
        json={"name": "Webhook Integration", "color": "#6366f1", "status": "not_started"},
        headers=headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Webhook Integration"
    assert data["color"] == "#6366f1"
    assert data["status"] == "not_started"
    assert data["project_id"] == str(project.id)
    assert data["task_count"] == 0
    assert data["done_count"] == 0


@pytest.mark.asyncio
async def test_list_epics(client, project, headers):
    await make_epic(client, project, headers, "Epic A")
    await make_epic(client, project, headers, "Epic B")

    resp = await client.get(f"/api/v1/projects/{project.id}/epics", headers=headers)
    assert resp.status_code == 200
    names = [e["name"] for e in resp.json()]
    assert "Epic A" in names
    assert "Epic B" in names


@pytest.mark.asyncio
async def test_get_epic(client, project, headers):
    created = await make_epic(client, project, headers)
    resp = await client.get(f"/api/v1/epics/{created['id']}", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == created["id"]


@pytest.mark.asyncio
async def test_update_epic(client, project, headers):
    created = await make_epic(client, project, headers)
    resp = await client.patch(
        f"/api/v1/epics/{created['id']}",
        json={"name": "Renamed Epic", "status": "in_progress"},
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Renamed Epic"
    assert data["status"] == "in_progress"


@pytest.mark.asyncio
async def test_delete_epic(client, project, headers):
    created = await make_epic(client, project, headers)
    resp = await client.delete(f"/api/v1/epics/{created['id']}", headers=headers)
    assert resp.status_code == 204

    # Should 404 after soft delete
    resp = await client.get(f"/api/v1/epics/{created['id']}", headers=headers)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_epic_unlinks_tasks(client, project, list_, headers):
    epic = await make_epic(client, project, headers)
    task = await make_task(client, list_, headers)

    # Assign task to epic
    resp = await client.patch(
        f"/api/v1/tasks/{task['id']}",
        json={"epic_id": epic["id"]},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["epic_id"] == epic["id"]

    # Delete epic
    await client.delete(f"/api/v1/epics/{epic['id']}", headers=headers)

    # Task should still exist but epic_id cleared
    resp = await client.get(f"/api/v1/tasks/{task['id']}", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["epic_id"] is None


# ── E-01: Access control ──────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_epic_unauthenticated(client, project):
    resp = await client.post(
        f"/api/v1/projects/{project.id}/epics",
        json={"name": "Unauthorized"},
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_create_epic_non_member(client, db, project):
    outsider = await make_user(db, email="outsider@example.com")
    outsider_headers = auth_headers(outsider)
    resp = await client.post(
        f"/api/v1/projects/{project.id}/epics",
        json={"name": "Should Fail"},
        headers=outsider_headers,
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_get_epic_not_found(client, headers):
    from uuid import uuid4
    resp = await client.get(f"/api/v1/epics/{uuid4()}", headers=headers)
    assert resp.status_code == 404


# ── E-02: Assign tasks to epics ───────────────────────────────────────────────

@pytest.mark.asyncio
async def test_assign_task_to_epic(client, project, list_, headers):
    epic = await make_epic(client, project, headers)
    task = await make_task(client, list_, headers)

    resp = await client.patch(
        f"/api/v1/tasks/{task['id']}",
        json={"epic_id": epic["id"]},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["epic_id"] == epic["id"]


@pytest.mark.asyncio
async def test_clear_task_epic(client, project, list_, headers):
    epic = await make_epic(client, project, headers)
    task = await make_task(client, list_, headers)

    # Assign
    await client.patch(
        f"/api/v1/tasks/{task['id']}",
        json={"epic_id": epic["id"]},
        headers=headers,
    )

    # Clear
    resp = await client.patch(
        f"/api/v1/tasks/{task['id']}",
        json={"epic_id": None},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["epic_id"] is None


@pytest.mark.asyncio
async def test_create_task_with_epic(client, project, list_, headers):
    epic = await make_epic(client, project, headers)
    resp = await client.post(
        f"/api/v1/lists/{list_.id}/tasks",
        json={"title": "Task in epic", "epic_id": epic["id"]},
        headers=headers,
    )
    assert resp.status_code == 201
    assert resp.json()["epic_id"] == epic["id"]


@pytest.mark.asyncio
async def test_list_epic_tasks(client, project, list_, headers):
    epic = await make_epic(client, project, headers)

    # Create tasks in epic
    t1 = await make_task(client, list_, headers, "Task 1")
    t2 = await make_task(client, list_, headers, "Task 2")
    await make_task(client, list_, headers, "Task 3 not in epic")

    for t in [t1, t2]:
        await client.patch(
            f"/api/v1/tasks/{t['id']}",
            json={"epic_id": epic["id"]},
            headers=headers,
        )

    resp = await client.get(f"/api/v1/epics/{epic['id']}/tasks", headers=headers)
    assert resp.status_code == 200
    task_ids = {t["id"] for t in resp.json()}
    assert t1["id"] in task_ids
    assert t2["id"] in task_ids
    assert len(task_ids) == 2


@pytest.mark.asyncio
async def test_epic_task_count(client, project, list_, headers):
    epic = await make_epic(client, project, headers)
    t1 = await make_task(client, list_, headers)
    t2 = await make_task(client, list_, headers)

    for t in [t1, t2]:
        await client.patch(
            f"/api/v1/tasks/{t['id']}",
            json={"epic_id": epic["id"]},
            headers=headers,
        )

    resp = await client.get(f"/api/v1/epics/{epic['id']}", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["task_count"] == 2
