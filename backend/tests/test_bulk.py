import pytest
from httpx import AsyncClient
from tests.conftest import make_user, auth_headers


async def _make_tasks(client: AsyncClient, list_, headers, count: int = 3) -> list[dict]:
    tasks = []
    for i in range(count):
        r = await client.post(
            f"/api/v1/lists/{list_.id}/tasks",
            json={"title": f"Task {i + 1}"},
            headers=headers,
        )
        assert r.status_code == 201
        tasks.append(r.json())
    return tasks


async def test_bulk_update_status(client: AsyncClient, db, user, workspace, project, list_, headers):
    tasks = await _make_tasks(client, list_, headers)

    # Create a status
    status_r = await client.post(
        f"/api/v1/lists/{list_.id}/statuses",
        json={"name": "Done", "color": "#22c55e", "category": "done"},
        headers=headers,
    )
    assert status_r.status_code == 201
    status_id = status_r.json()["id"]

    task_ids = [t["id"] for t in tasks]
    r = await client.post(
        "/api/v1/tasks/bulk-update",
        json={"task_ids": task_ids, "status_id": status_id},
        headers=headers,
    )
    assert r.status_code == 200
    assert r.json()["updated"] == 3

    # Verify tasks updated
    for task in tasks:
        t_r = await client.get(f"/api/v1/tasks/{task['id']}", headers=headers)
        assert t_r.json()["status_id"] == status_id


async def test_bulk_update_priority(client: AsyncClient, db, user, workspace, project, list_, headers):
    tasks = await _make_tasks(client, list_, headers)
    task_ids = [t["id"] for t in tasks]

    r = await client.post(
        "/api/v1/tasks/bulk-update",
        json={"task_ids": task_ids, "priority": "high"},
        headers=headers,
    )
    assert r.status_code == 200
    assert r.json()["updated"] == 3

    for task in tasks:
        t_r = await client.get(f"/api/v1/tasks/{task['id']}", headers=headers)
        assert t_r.json()["priority"] == "high"


async def test_bulk_delete(client: AsyncClient, db, user, workspace, project, list_, headers):
    tasks = await _make_tasks(client, list_, headers)
    task_ids = [t["id"] for t in tasks]

    r = await client.post(
        "/api/v1/tasks/bulk-delete",
        json={"task_ids": task_ids},
        headers=headers,
    )
    assert r.status_code == 200
    assert r.json()["updated"] == 3

    # Verify all deleted
    list_r = await client.get(f"/api/v1/lists/{list_.id}/tasks", headers=headers)
    assert list_r.status_code == 200
    assert len(list_r.json()) == 0


async def test_bulk_non_member_forbidden(client: AsyncClient, db, user, workspace, project, list_, headers):
    tasks = await _make_tasks(client, list_, headers)
    task_ids = [t["id"] for t in tasks]

    other = await make_user(db, "other@example.com")
    await db.commit()
    other_headers = auth_headers(other)

    r = await client.post(
        "/api/v1/tasks/bulk-delete",
        json={"task_ids": task_ids},
        headers=other_headers,
    )
    assert r.status_code == 403


async def test_bulk_empty_ids_rejected(client: AsyncClient, db, user, workspace, project, list_, headers):
    r = await client.post(
        "/api/v1/tasks/bulk-delete",
        json={"task_ids": []},
        headers=headers,
    )
    assert r.status_code == 422
