import pytest
from httpx import AsyncClient
from tests.conftest import make_task


async def test_add_link(client: AsyncClient, db, user, workspace, project, list_, headers):
    task = await make_task(client, list_, headers)
    resp = await client.post(
        f"/api/v1/tasks/{task['id']}/links",
        json={"url": "https://example.com", "title": "Example"},
        headers=headers,
    )
    assert resp.status_code == 201
    assert resp.json()["url"] == "https://example.com"
    assert resp.json()["title"] == "Example"


async def test_list_links(client: AsyncClient, db, user, workspace, project, list_, headers):
    task = await make_task(client, list_, headers)
    await client.post(f"/api/v1/tasks/{task['id']}/links", json={"url": "https://a.com"}, headers=headers)
    await client.post(f"/api/v1/tasks/{task['id']}/links", json={"url": "https://b.com"}, headers=headers)
    resp = await client.get(f"/api/v1/tasks/{task['id']}/links", headers=headers)
    assert resp.status_code == 200
    assert len(resp.json()) == 2


async def test_delete_link(client: AsyncClient, db, user, workspace, project, list_, headers):
    task = await make_task(client, list_, headers)
    add_resp = await client.post(
        f"/api/v1/tasks/{task['id']}/links",
        json={"url": "https://example.com"},
        headers=headers,
    )
    link_id = add_resp.json()["id"]
    del_resp = await client.delete(f"/api/v1/tasks/{task['id']}/links/{link_id}", headers=headers)
    assert del_resp.status_code == 204
    list_resp = await client.get(f"/api/v1/tasks/{task['id']}/links", headers=headers)
    assert list_resp.json() == []


async def test_link_not_found(client: AsyncClient, db, user, workspace, project, list_, headers):
    task = await make_task(client, list_, headers)
    import uuid
    resp = await client.delete(
        f"/api/v1/tasks/{task['id']}/links/{uuid.uuid4()}",
        headers=headers,
    )
    assert resp.status_code == 404


async def test_link_audit_logged(client: AsyncClient, db, user, workspace, project, list_, headers):
    from app.models.audit_log import AuditLog
    from sqlalchemy import select
    task = await make_task(client, list_, headers)
    await client.post(
        f"/api/v1/tasks/{task['id']}/links",
        json={"url": "https://example.com", "title": "Docs"},
        headers=headers,
    )
    result = await db.execute(select(AuditLog).where(AuditLog.task_id == task["id"]))
    all_logs = list(result.scalars().all())
    actions = [l.action for l in all_logs]
    assert "link_added" in actions
