import pytest
from httpx import AsyncClient
from tests.conftest import make_task


async def test_filter_by_text_field(client: AsyncClient, db, user, workspace, project, list_, headers):
    """Tasks can be filtered by a text custom field value."""
    # Create a custom field
    cf_resp = await client.post(
        f"/api/v1/lists/{list_.id}/custom-fields",
        json={"name": "Category", "field_type": "text"},
        headers=headers,
    )
    assert cf_resp.status_code == 201
    field_id = cf_resp.json()["id"]

    # Create two tasks
    t1 = await make_task(client, list_, headers, title="Task Alpha")
    t2 = await make_task(client, list_, headers, title="Task Beta")

    # Set field value for t1 only
    await client.put(
        f"/api/v1/tasks/{t1['id']}/field-values",
        json={"values": {field_id: "frontend"}},
        headers=headers,
    )

    # Filter: should return only t1
    resp = await client.get(
        f"/api/v1/lists/{list_.id}/tasks",
        params={f"cf[{field_id}]": "frontend"},
        headers=headers,
    )
    assert resp.status_code == 200
    ids = [t["id"] for t in resp.json()]
    assert t1["id"] in ids
    assert t2["id"] not in ids


async def test_no_filter_returns_all(client: AsyncClient, db, user, workspace, project, list_, headers):
    """Without cf filter, all tasks are returned."""
    t1 = await make_task(client, list_, headers)
    t2 = await make_task(client, list_, headers)
    resp = await client.get(f"/api/v1/lists/{list_.id}/tasks", headers=headers)
    assert resp.status_code == 200
    ids = [t["id"] for t in resp.json()]
    assert t1["id"] in ids
    assert t2["id"] in ids
