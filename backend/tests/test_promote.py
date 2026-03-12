import pytest


async def _task(client, list_id, headers, title="Task"):
    r = await client.post(f"/api/v1/lists/{list_id}/tasks", json={"title": title}, headers=headers)
    return r.json()


async def _subtask(client, parent_id, headers, title="Subtask"):
    r = await client.post(f"/api/v1/tasks/{parent_id}/subtasks", json={"title": title}, headers=headers)
    return r.json()


async def test_promote_subtask(client, list_, headers):
    parent = await _task(client, list_.id, headers, "Parent")
    child = await _subtask(client, parent["id"], headers, "Child")

    assert child["parent_task_id"] == parent["id"]
    assert child["depth"] == 1

    r = await client.post(f"/api/v1/tasks/{child['id']}/promote", headers=headers)
    assert r.status_code == 200
    data = r.json()
    assert data["parent_task_id"] is None
    assert data["depth"] == 0


async def test_promoted_task_appears_in_list(client, list_, headers):
    parent = await _task(client, list_.id, headers, "Parent")
    child = await _subtask(client, parent["id"], headers, "Child")

    await client.post(f"/api/v1/tasks/{child['id']}/promote", headers=headers)

    r = await client.get(f"/api/v1/lists/{list_.id}/tasks", headers=headers)
    ids = [t["id"] for t in r.json()]
    assert child["id"] in ids


async def test_promote_top_level_task_returns_400(client, list_, headers):
    task = await _task(client, list_.id, headers)
    r = await client.post(f"/api/v1/tasks/{task['id']}/promote", headers=headers)
    assert r.status_code == 400


async def test_promote_writes_audit_log(client, list_, headers):
    parent = await _task(client, list_.id, headers, "Parent")
    child = await _subtask(client, parent["id"], headers, "Child")

    await client.post(f"/api/v1/tasks/{child['id']}/promote", headers=headers)

    r = await client.get(f"/api/v1/tasks/{child['id']}/audit", headers=headers)
    actions = [l["action"] for l in r.json()]
    assert "promoted" in actions


async def test_promote_clears_subtask_from_parent(client, list_, headers):
    parent = await _task(client, list_.id, headers, "Parent")
    child = await _subtask(client, parent["id"], headers, "Child")

    await client.post(f"/api/v1/tasks/{child['id']}/promote", headers=headers)

    r = await client.get(f"/api/v1/tasks/{parent['id']}/subtasks", headers=headers)
    assert all(s["id"] != child["id"] for s in r.json())
