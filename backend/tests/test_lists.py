import pytest


async def test_create_list(client, project, headers):
    r = await client.post(
        f"/api/v1/projects/{project.id}/lists",
        json={"name": "Sprint 1"},
        headers=headers,
    )
    assert r.status_code == 201
    assert r.json()["name"] == "Sprint 1"


async def test_list_lists(client, list_, project, headers):
    r = await client.get(f"/api/v1/projects/{project.id}/lists", headers=headers)
    assert r.status_code == 200
    ids = [l["id"] for l in r.json()]
    assert str(list_.id) in ids


async def test_get_list(client, list_, headers):
    r = await client.get(f"/api/v1/lists/{list_.id}", headers=headers)
    assert r.status_code == 200
    assert r.json()["id"] == str(list_.id)


async def test_update_list(client, list_, headers):
    r = await client.patch(
        f"/api/v1/lists/{list_.id}",
        json={"name": "Renamed"},
        headers=headers,
    )
    assert r.status_code == 200
    assert r.json()["name"] == "Renamed"


async def test_create_status(client, list_, headers):
    r = await client.post(
        f"/api/v1/lists/{list_.id}/statuses",
        json={"name": "In Progress", "color": "#3b82f6", "category": "active"},
        headers=headers,
    )
    assert r.status_code == 201
    assert r.json()["name"] == "In Progress"


async def test_list_statuses_on_get(client, list_, headers):
    await client.post(
        f"/api/v1/lists/{list_.id}/statuses",
        json={"name": "Todo", "color": "#6b7280", "category": "not_started"},
        headers=headers,
    )
    r = await client.get(f"/api/v1/lists/{list_.id}", headers=headers)
    assert r.status_code == 200
    assert len(r.json()["statuses"]) == 1


async def test_update_status(client, list_, headers):
    r = await client.post(
        f"/api/v1/lists/{list_.id}/statuses",
        json={"name": "Todo", "color": "#6b7280", "category": "not_started"},
        headers=headers,
    )
    status_id = r.json()["id"]
    r2 = await client.patch(
        f"/api/v1/lists/{list_.id}/statuses/{status_id}",
        json={"name": "Backlog"},
        headers=headers,
    )
    assert r2.status_code == 200
    assert r2.json()["name"] == "Backlog"


async def test_reorder_statuses(client, list_, headers):
    s1 = (await client.post(
        f"/api/v1/lists/{list_.id}/statuses",
        json={"name": "A", "color": "#111111", "category": "not_started"},
        headers=headers,
    )).json()
    s2 = (await client.post(
        f"/api/v1/lists/{list_.id}/statuses",
        json={"name": "B", "color": "#222222", "category": "active"},
        headers=headers,
    )).json()
    # Move s2 before s1 (s1 should come after s2)
    r = await client.post(
        f"/api/v1/lists/{list_.id}/statuses/{s2['id']}/reorder",
        json={"before_id": None, "after_id": s1["id"]},
        headers=headers,
    )
    assert r.status_code == 200
    s2_order = next(s["order_index"] for s in r.json() if s["id"] == s2["id"])
    s1_order = next(s["order_index"] for s in r.json() if s["id"] == s1["id"])
    assert s2_order < s1_order


async def test_delete_status(client, list_, headers):
    s = (await client.post(
        f"/api/v1/lists/{list_.id}/statuses",
        json={"name": "Done", "color": "#22c55e", "category": "done"},
        headers=headers,
    )).json()
    r = await client.delete(f"/api/v1/lists/{list_.id}/statuses/{s['id']}", headers=headers)
    assert r.status_code == 204
