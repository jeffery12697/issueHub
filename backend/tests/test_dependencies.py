import pytest


async def _task(client, list_id, headers, title="Task"):
    r = await client.post(f"/api/v1/lists/{list_id}/tasks", json={"title": title}, headers=headers)
    return r.json()


async def test_add_blocked_by(client, list_, headers):
    t1 = await _task(client, list_.id, headers, "Blocker")
    t2 = await _task(client, list_.id, headers, "Blocked")
    r = await client.post(
        f"/api/v1/tasks/{t2['id']}/blocked-by",
        json={"depends_on_id": t1["id"]},
        headers=headers,
    )
    assert r.status_code == 201


async def test_get_blocked_by(client, list_, headers):
    t1 = await _task(client, list_.id, headers, "Blocker")
    t2 = await _task(client, list_.id, headers, "Blocked")
    await client.post(
        f"/api/v1/tasks/{t2['id']}/blocked-by",
        json={"depends_on_id": t1["id"]},
        headers=headers,
    )
    r = await client.get(f"/api/v1/tasks/{t2['id']}/blocked-by", headers=headers)
    assert r.status_code == 200
    assert len(r.json()) == 1
    assert r.json()[0]["id"] == t1["id"]


async def test_get_blocking(client, list_, headers):
    t1 = await _task(client, list_.id, headers, "Blocker")
    t2 = await _task(client, list_.id, headers, "Blocked")
    await client.post(
        f"/api/v1/tasks/{t2['id']}/blocked-by",
        json={"depends_on_id": t1["id"]},
        headers=headers,
    )
    r = await client.get(f"/api/v1/tasks/{t1['id']}/blocking", headers=headers)
    assert r.status_code == 200
    assert len(r.json()) == 1
    assert r.json()[0]["id"] == t2["id"]


async def test_remove_blocked_by(client, list_, headers):
    t1 = await _task(client, list_.id, headers, "Blocker")
    t2 = await _task(client, list_.id, headers, "Blocked")
    await client.post(
        f"/api/v1/tasks/{t2['id']}/blocked-by",
        json={"depends_on_id": t1["id"]},
        headers=headers,
    )
    r = await client.delete(f"/api/v1/tasks/{t2['id']}/blocked-by/{t1['id']}", headers=headers)
    assert r.status_code == 204
    r2 = await client.get(f"/api/v1/tasks/{t2['id']}/blocked-by", headers=headers)
    assert r2.json() == []


async def test_self_dependency_rejected(client, list_, headers):
    t = await _task(client, list_.id, headers)
    r = await client.post(
        f"/api/v1/tasks/{t['id']}/blocked-by",
        json={"depends_on_id": t["id"]},
        headers=headers,
    )
    assert r.status_code == 400


async def test_circular_dependency_rejected(client, list_, headers):
    t1 = await _task(client, list_.id, headers, "A")
    t2 = await _task(client, list_.id, headers, "B")
    # t2 blocked by t1
    await client.post(
        f"/api/v1/tasks/{t2['id']}/blocked-by",
        json={"depends_on_id": t1["id"]},
        headers=headers,
    )
    # t1 blocked by t2 — circular!
    r = await client.post(
        f"/api/v1/tasks/{t1['id']}/blocked-by",
        json={"depends_on_id": t2["id"]},
        headers=headers,
    )
    assert r.status_code == 400


async def test_duplicate_dependency_rejected(client, list_, headers):
    t1 = await _task(client, list_.id, headers, "A")
    t2 = await _task(client, list_.id, headers, "B")
    await client.post(
        f"/api/v1/tasks/{t2['id']}/blocked-by",
        json={"depends_on_id": t1["id"]},
        headers=headers,
    )
    r = await client.post(
        f"/api/v1/tasks/{t2['id']}/blocked-by",
        json={"depends_on_id": t1["id"]},
        headers=headers,
    )
    assert r.status_code == 400


async def test_multiple_blockers(client, list_, headers):
    t1 = await _task(client, list_.id, headers, "Blocker 1")
    t2 = await _task(client, list_.id, headers, "Blocker 2")
    blocked = await _task(client, list_.id, headers, "Blocked")
    await client.post(
        f"/api/v1/tasks/{blocked['id']}/blocked-by",
        json={"depends_on_id": t1["id"]},
        headers=headers,
    )
    await client.post(
        f"/api/v1/tasks/{blocked['id']}/blocked-by",
        json={"depends_on_id": t2["id"]},
        headers=headers,
    )
    r = await client.get(f"/api/v1/tasks/{blocked['id']}/blocked-by", headers=headers)
    assert len(r.json()) == 2
