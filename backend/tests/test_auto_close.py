"""Tests for AU-03: auto-close parent task when all subtasks are done."""
import pytest
from httpx import AsyncClient

from tests.conftest import make_user, make_workspace, make_project, make_list, auth_headers
from app.models.list_status import ListStatus


async def make_complete_status(db, list_) -> dict:
    """Add a complete status to the list and return its id."""
    status = ListStatus(list_id=list_.id, name="Done", color="#22c55e", order_index=99, is_complete=True)
    db.add(status)
    await db.flush()
    return {"id": str(status.id), "name": status.name}


async def make_task(client: AsyncClient, list_, headers) -> dict:
    r = await client.post(f"/api/v1/lists/{list_.id}/tasks", json={"title": "Parent"}, headers=headers)
    assert r.status_code == 201
    return r.json()


async def make_subtask(client: AsyncClient, parent_id: str, headers, title: str = "Sub") -> dict:
    r = await client.post(f"/api/v1/tasks/{parent_id}/subtasks", json={"title": title}, headers=headers)
    assert r.status_code == 201
    return r.json()


# ── auto-close ────────────────────────────────────────────────────────────────


async def test_parent_auto_closed_when_all_subtasks_done(
    client: AsyncClient, db, user, workspace, project, list_, headers
):
    """Parent is auto-closed when every subtask reaches a complete status."""
    done = await make_complete_status(db, list_)
    await db.commit()

    parent = await make_task(client, list_, headers)
    sub1 = await make_subtask(client, parent["id"], headers, "Sub 1")
    sub2 = await make_subtask(client, parent["id"], headers, "Sub 2")

    # Close sub1 — parent should stay open
    await client.patch(f"/api/v1/tasks/{sub1['id']}", json={"status_id": done["id"]}, headers=headers)
    r = await client.get(f"/api/v1/tasks/{parent['id']}", headers=headers)
    assert r.json()["status_id"] is None  # not yet closed

    # Close sub2 — now all subtasks done, parent should be auto-closed
    await client.patch(f"/api/v1/tasks/{sub2['id']}", json={"status_id": done["id"]}, headers=headers)
    r = await client.get(f"/api/v1/tasks/{parent['id']}", headers=headers)
    assert r.json()["status_id"] == done["id"]


async def test_parent_not_closed_if_one_subtask_incomplete(
    client: AsyncClient, db, user, workspace, project, list_, headers
):
    """Parent stays open when at least one subtask is not complete."""
    done = await make_complete_status(db, list_)
    await db.commit()

    parent = await make_task(client, list_, headers)
    sub1 = await make_subtask(client, parent["id"], headers, "Sub 1")
    await make_subtask(client, parent["id"], headers, "Sub 2")  # left open

    await client.patch(f"/api/v1/tasks/{sub1['id']}", json={"status_id": done["id"]}, headers=headers)
    r = await client.get(f"/api/v1/tasks/{parent['id']}", headers=headers)
    assert r.json()["status_id"] is None


async def test_parent_not_closed_if_no_complete_status_in_list(
    client: AsyncClient, db, user, workspace, project, list_, headers
):
    """If the list has no complete status, parent is never auto-closed."""
    # Add a non-complete status
    status = ListStatus(list_id=list_.id, name="In Progress", color="#6366f1", order_index=1, is_complete=False)
    db.add(status)
    await db.commit()

    parent = await make_task(client, list_, headers)
    sub = await make_subtask(client, parent["id"], headers)

    await client.patch(f"/api/v1/tasks/{sub['id']}", json={"status_id": str(status.id)}, headers=headers)
    r = await client.get(f"/api/v1/tasks/{parent['id']}", headers=headers)
    assert r.json()["status_id"] is None


async def test_parent_not_closed_again_if_already_complete(
    client: AsyncClient, db, user, workspace, project, list_, headers
):
    """If parent is already closed, auto-close does not re-trigger."""
    done = await make_complete_status(db, list_)
    await db.commit()

    parent = await make_task(client, list_, headers)
    sub = await make_subtask(client, parent["id"], headers)

    # Manually close parent first
    await client.patch(f"/api/v1/tasks/{parent['id']}", json={"status_id": done["id"]}, headers=headers)

    # Now close the subtask — should not error
    r = await client.patch(f"/api/v1/tasks/{sub['id']}", json={"status_id": done["id"]}, headers=headers)
    assert r.status_code == 200


async def test_auto_close_audit_log_created(
    client: AsyncClient, db, user, workspace, project, list_, headers
):
    """An auto_closed audit log entry is created on the parent."""
    done = await make_complete_status(db, list_)
    await db.commit()

    parent = await make_task(client, list_, headers)
    sub = await make_subtask(client, parent["id"], headers)

    await client.patch(f"/api/v1/tasks/{sub['id']}", json={"status_id": done["id"]}, headers=headers)

    logs = await client.get(f"/api/v1/tasks/{parent['id']}/audit", headers=headers)
    assert logs.status_code == 200
    actions = [l["action"] for l in logs.json()]
    assert "auto_closed" in actions
