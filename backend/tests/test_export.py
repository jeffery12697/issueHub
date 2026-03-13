import pytest
from httpx import AsyncClient
from tests.conftest import make_user, auth_headers


async def test_export_csv_returns_csv(client: AsyncClient, db, user, workspace, project, list_, headers):
    await client.post(
        f"/api/v1/lists/{list_.id}/tasks",
        json={"title": "Export Task"},
        headers=headers,
    )
    r = await client.get(f"/api/v1/lists/{list_.id}/tasks/export", headers=headers)
    assert r.status_code == 200
    assert "text/csv" in r.headers.get("content-type", "")


async def test_export_csv_contains_task_title(client: AsyncClient, db, user, workspace, project, list_, headers):
    await client.post(
        f"/api/v1/lists/{list_.id}/tasks",
        json={"title": "My Special Task"},
        headers=headers,
    )
    r = await client.get(f"/api/v1/lists/{list_.id}/tasks/export", headers=headers)
    assert r.status_code == 200
    assert "My Special Task" in r.text


async def test_export_non_member_forbidden(client: AsyncClient, db, user, workspace, project, list_, headers):
    other = await make_user(db, "other@example.com")
    await db.commit()
    other_headers = auth_headers(other)

    r = await client.get(f"/api/v1/lists/{list_.id}/tasks/export", headers=other_headers)
    assert r.status_code == 403
