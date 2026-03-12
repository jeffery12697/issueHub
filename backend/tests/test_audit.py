import pytest


async def _create_task(client, list_id, headers, title="Task"):
    r = await client.post(f"/api/v1/lists/{list_id}/tasks", json={"title": title}, headers=headers)
    return r.json()


async def test_audit_log_created_on_task_create(client, list_, headers):
    task = await _create_task(client, list_.id, headers)
    r = await client.get(f"/api/v1/tasks/{task['id']}/audit", headers=headers)
    assert r.status_code == 200
    logs = r.json()
    assert len(logs) == 1
    assert logs[0]["action"] == "created"
    assert logs[0]["changes"] is None


async def test_audit_log_on_title_update(client, list_, headers):
    task = await _create_task(client, list_.id, headers, "Old Title")
    await client.patch(f"/api/v1/tasks/{task['id']}", json={"title": "New Title"}, headers=headers)
    r = await client.get(f"/api/v1/tasks/{task['id']}/audit", headers=headers)
    logs = r.json()
    assert len(logs) == 2
    update_log = next(l for l in logs if l["action"] == "updated")
    assert "title" in update_log["changes"]
    assert update_log["changes"]["title"][1] == "New Title"


async def test_audit_log_on_priority_update(client, list_, headers):
    task = await _create_task(client, list_.id, headers)
    await client.patch(f"/api/v1/tasks/{task['id']}", json={"priority": "high"}, headers=headers)
    r = await client.get(f"/api/v1/tasks/{task['id']}/audit", headers=headers)
    logs = r.json()
    update_log = next(l for l in logs if l["action"] == "updated")
    assert "priority" in update_log["changes"]
    assert update_log["changes"]["priority"][1] == "high"


async def test_no_audit_log_when_nothing_changes(client, list_, headers):
    task = await _create_task(client, list_.id, headers, "Same Title")
    # Patching with the same title — service only logs if diff is non-empty
    await client.patch(f"/api/v1/tasks/{task['id']}", json={"title": "Same Title"}, headers=headers)
    r = await client.get(f"/api/v1/tasks/{task['id']}/audit", headers=headers)
    # Only the "created" entry, no "updated" entry
    assert all(l["action"] != "updated" for l in r.json())


async def test_audit_log_on_delete(client, list_, headers):
    task = await _create_task(client, list_.id, headers)
    await client.delete(f"/api/v1/tasks/{task['id']}", headers=headers)
    # Query audit before the task 404s
    r = await client.get(f"/api/v1/tasks/{task['id']}/audit", headers=headers)
    actions = [l["action"] for l in r.json()]
    assert "deleted" in actions


async def test_audit_logs_ordered_newest_first(client, list_, headers):
    task = await _create_task(client, list_.id, headers)
    await client.patch(f"/api/v1/tasks/{task['id']}", json={"title": "V2"}, headers=headers)
    await client.patch(f"/api/v1/tasks/{task['id']}", json={"title": "V3"}, headers=headers)
    r = await client.get(f"/api/v1/tasks/{task['id']}/audit", headers=headers)
    logs = r.json()
    assert logs[0]["action"] == "updated"  # most recent first
    assert logs[-1]["action"] == "created"
