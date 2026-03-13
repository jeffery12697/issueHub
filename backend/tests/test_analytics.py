import pytest
from datetime import datetime, timedelta, timezone
from httpx import AsyncClient
from tests.conftest import make_user, auth_headers


async def test_analytics_total_count(client: AsyncClient, db, user, workspace, project, list_, headers):
    for i in range(3):
        await client.post(
            f"/api/v1/lists/{list_.id}/tasks",
            json={"title": f"Task {i + 1}"},
            headers=headers,
        )

    r = await client.get(f"/api/v1/workspaces/{workspace.id}/analytics", headers=headers)
    assert r.status_code == 200
    data = r.json()
    assert data["total_tasks"] == 3


async def test_analytics_overdue(client: AsyncClient, db, user, workspace, project, list_, headers):
    past_date = (datetime.now(timezone.utc) - timedelta(days=2)).isoformat()
    await client.post(
        f"/api/v1/lists/{list_.id}/tasks",
        json={"title": "Overdue task", "due_date": past_date},
        headers=headers,
    )
    await client.post(
        f"/api/v1/lists/{list_.id}/tasks",
        json={"title": "No due date"},
        headers=headers,
    )

    r = await client.get(f"/api/v1/workspaces/{workspace.id}/analytics", headers=headers)
    assert r.status_code == 200
    data = r.json()
    assert data["overdue_tasks"] == 1


async def test_analytics_non_member_forbidden(client: AsyncClient, db, user, workspace, project, list_, headers):
    other = await make_user(db, "other@example.com")
    await db.commit()
    other_headers = auth_headers(other)

    r = await client.get(f"/api/v1/workspaces/{workspace.id}/analytics", headers=other_headers)
    assert r.status_code == 403
