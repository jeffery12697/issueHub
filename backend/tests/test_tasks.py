import pytest
from tests.conftest import make_list


async def test_create_task(client, list_, headers):
    r = await client.post(
        f"/api/v1/lists/{list_.id}/tasks",
        json={"title": "Fix bug"},
        headers=headers,
    )
    assert r.status_code == 201
    data = r.json()
    assert data["title"] == "Fix bug"
    assert data["priority"] == "none"
    assert data["depth"] == 0
    assert data["parent_task_id"] is None


async def test_create_task_with_priority(client, list_, headers):
    r = await client.post(
        f"/api/v1/lists/{list_.id}/tasks",
        json={"title": "Urgent fix", "priority": "urgent"},
        headers=headers,
    )
    assert r.status_code == 201
    assert r.json()["priority"] == "urgent"


async def test_list_tasks(client, list_, headers):
    await client.post(f"/api/v1/lists/{list_.id}/tasks", json={"title": "T1"}, headers=headers)
    await client.post(f"/api/v1/lists/{list_.id}/tasks", json={"title": "T2"}, headers=headers)
    r = await client.get(f"/api/v1/lists/{list_.id}/tasks", headers=headers)
    assert r.status_code == 200
    assert len(r.json()) == 2


async def test_list_tasks_excludes_subtasks(client, list_, headers):
    parent = (await client.post(
        f"/api/v1/lists/{list_.id}/tasks", json={"title": "Parent"}, headers=headers
    )).json()
    await client.post(f"/api/v1/tasks/{parent['id']}/subtasks", json={"title": "Child"}, headers=headers)
    r = await client.get(f"/api/v1/lists/{list_.id}/tasks", headers=headers)
    assert len(r.json()) == 1  # only root task


async def test_get_task(client, list_, headers):
    task = (await client.post(
        f"/api/v1/lists/{list_.id}/tasks", json={"title": "My task"}, headers=headers
    )).json()
    r = await client.get(f"/api/v1/tasks/{task['id']}", headers=headers)
    assert r.status_code == 200
    assert r.json()["id"] == task["id"]


async def test_update_task_title(client, list_, headers):
    task = (await client.post(
        f"/api/v1/lists/{list_.id}/tasks", json={"title": "Old"}, headers=headers
    )).json()
    r = await client.patch(f"/api/v1/tasks/{task['id']}", json={"title": "New"}, headers=headers)
    assert r.status_code == 200
    assert r.json()["title"] == "New"


async def test_update_task_status(client, list_, headers):
    status_resp = (await client.post(
        f"/api/v1/lists/{list_.id}/statuses",
        json={"name": "Done", "color": "#22c55e", "category": "done"},
        headers=headers,
    )).json()
    task = (await client.post(
        f"/api/v1/lists/{list_.id}/tasks", json={"title": "Task"}, headers=headers
    )).json()
    r = await client.patch(
        f"/api/v1/tasks/{task['id']}",
        json={"status_id": status_resp["id"]},
        headers=headers,
    )
    assert r.status_code == 200
    assert r.json()["status_id"] == status_resp["id"]


async def test_delete_task(client, list_, headers):
    task = (await client.post(
        f"/api/v1/lists/{list_.id}/tasks", json={"title": "To delete"}, headers=headers
    )).json()
    r = await client.delete(f"/api/v1/tasks/{task['id']}", headers=headers)
    assert r.status_code == 204
    r2 = await client.get(f"/api/v1/tasks/{task['id']}", headers=headers)
    assert r2.status_code == 404


async def test_deleted_task_excluded_from_list(client, list_, headers):
    task = (await client.post(
        f"/api/v1/lists/{list_.id}/tasks", json={"title": "Gone"}, headers=headers
    )).json()
    await client.delete(f"/api/v1/tasks/{task['id']}", headers=headers)
    r = await client.get(f"/api/v1/lists/{list_.id}/tasks", headers=headers)
    assert all(t["id"] != task["id"] for t in r.json())


async def test_create_subtask(client, list_, headers):
    parent = (await client.post(
        f"/api/v1/lists/{list_.id}/tasks", json={"title": "Parent"}, headers=headers
    )).json()
    r = await client.post(
        f"/api/v1/tasks/{parent['id']}/subtasks",
        json={"title": "Child"},
        headers=headers,
    )
    assert r.status_code == 201
    data = r.json()
    assert data["parent_task_id"] == parent["id"]
    assert data["depth"] == 1


async def test_subtask_cannot_have_subtask(client, list_, headers):
    """Subtasks are max depth 1 — creating a grandchild returns 400."""
    parent = (await client.post(
        f"/api/v1/lists/{list_.id}/tasks", json={"title": "Parent"}, headers=headers
    )).json()
    child = (await client.post(
        f"/api/v1/tasks/{parent['id']}/subtasks", json={"title": "Child"}, headers=headers
    )).json()
    r = await client.post(
        f"/api/v1/tasks/{child['id']}/subtasks", json={"title": "Grandchild"}, headers=headers
    )
    assert r.status_code == 400
    assert "subtask" in r.json()["detail"].lower()


async def test_list_subtasks(client, list_, headers):
    parent = (await client.post(
        f"/api/v1/lists/{list_.id}/tasks", json={"title": "Parent"}, headers=headers
    )).json()
    await client.post(f"/api/v1/tasks/{parent['id']}/subtasks", json={"title": "C1"}, headers=headers)
    await client.post(f"/api/v1/tasks/{parent['id']}/subtasks", json={"title": "C2"}, headers=headers)
    r = await client.get(f"/api/v1/tasks/{parent['id']}/subtasks", headers=headers)
    assert r.status_code == 200
    assert len(r.json()) == 2


async def test_filter_tasks_by_priority(client, list_, headers):
    await client.post(f"/api/v1/lists/{list_.id}/tasks", json={"title": "Low", "priority": "low"}, headers=headers)
    await client.post(f"/api/v1/lists/{list_.id}/tasks", json={"title": "High", "priority": "high"}, headers=headers)
    r = await client.get(f"/api/v1/lists/{list_.id}/tasks?priority=high", headers=headers)
    assert r.status_code == 200
    assert len(r.json()) == 1
    assert r.json()[0]["priority"] == "high"


async def test_task_order_index_increments(client, list_, headers):
    t1 = (await client.post(f"/api/v1/lists/{list_.id}/tasks", json={"title": "T1"}, headers=headers)).json()
    t2 = (await client.post(f"/api/v1/lists/{list_.id}/tasks", json={"title": "T2"}, headers=headers)).json()
    assert t2["order_index"] > t1["order_index"]


async def test_subtask_can_be_assigned_to_different_list(client, db, project, list_, headers):
    """Subtask created with an explicit list_id ends up in that list."""
    other_list = await make_list(db, project, name="Other List")
    await db.commit()
    parent = (await client.post(
        f"/api/v1/lists/{list_.id}/tasks", json={"title": "Parent"}, headers=headers
    )).json()
    r = await client.post(
        f"/api/v1/tasks/{parent['id']}/subtasks",
        json={"title": "Child", "list_id": str(other_list.id)},
        headers=headers,
    )
    assert r.status_code == 201
    data = r.json()
    assert data["list_id"] == str(other_list.id)
    assert data["parent_task_id"] == parent["id"]


async def test_subtask_rejects_list_from_different_project(client, db, workspace, list_, headers):
    """Creating a subtask with a list_id from another project returns 400."""
    from tests.conftest import make_project
    other_project = await make_project(db, workspace, name="Other Project")
    other_list = await make_list(db, other_project, name="Other List")
    await db.commit()
    parent = (await client.post(
        f"/api/v1/lists/{list_.id}/tasks", json={"title": "Parent"}, headers=headers
    )).json()
    r = await client.post(
        f"/api/v1/tasks/{parent['id']}/subtasks",
        json={"title": "Child", "list_id": str(other_list.id)},
        headers=headers,
    )
    assert r.status_code == 400
