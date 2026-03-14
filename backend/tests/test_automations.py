"""Tests for AU-01: trigger-action automation rules."""
import pytest
from httpx import AsyncClient

from tests.conftest import make_user, make_workspace, make_project, make_list, auth_headers
from app.models.list_status import ListStatus


async def make_status(db, list_, name: str = "Done", is_complete: bool = True) -> ListStatus:
    s = ListStatus(list_id=list_.id, name=name, color="#22c55e", order_index=99, is_complete=is_complete)
    db.add(s)
    await db.flush()
    return s


async def make_task(client: AsyncClient, list_, headers, title: str = "Task") -> dict:
    r = await client.post(f"/api/v1/lists/{list_.id}/tasks", json={"title": title}, headers=headers)
    assert r.status_code == 201
    return r.json()


# ── CRUD ──────────────────────────────────────────────────────────────────────

async def test_create_automation(client: AsyncClient, db, user, workspace, project, list_, headers):
    """Create an automation rule and confirm it's returned in list."""
    done = await make_status(db, list_)
    await db.commit()

    r = await client.post(
        f"/api/v1/lists/{list_.id}/automations",
        json={
            "trigger_type": "status_changed",
            "trigger_value": str(done.id),
            "action_type": "set_priority",
            "action_value": "high",
        },
        headers=headers,
    )
    assert r.status_code == 201
    data = r.json()
    assert data["trigger_type"] == "status_changed"
    assert data["action_type"] == "set_priority"
    assert data["action_value"] == "high"
    assert data["list_id"] == str(list_.id)


async def test_list_automations(client: AsyncClient, db, user, workspace, project, list_, headers):
    """List endpoint returns all active automation rules for the list."""
    done = await make_status(db, list_)
    await db.commit()

    await client.post(
        f"/api/v1/lists/{list_.id}/automations",
        json={"trigger_type": "status_changed", "trigger_value": str(done.id), "action_type": "set_priority", "action_value": "urgent"},
        headers=headers,
    )
    await client.post(
        f"/api/v1/lists/{list_.id}/automations",
        json={"trigger_type": "priority_changed", "trigger_value": "urgent", "action_type": "set_priority", "action_value": "high"},
        headers=headers,
    )

    r = await client.get(f"/api/v1/lists/{list_.id}/automations", headers=headers)
    assert r.status_code == 200
    assert len(r.json()) == 2


async def test_delete_automation(client: AsyncClient, db, user, workspace, project, list_, headers):
    """Deleted automation is no longer returned."""
    done = await make_status(db, list_)
    await db.commit()

    create_r = await client.post(
        f"/api/v1/lists/{list_.id}/automations",
        json={"trigger_type": "status_changed", "trigger_value": str(done.id), "action_type": "set_priority", "action_value": "high"},
        headers=headers,
    )
    automation_id = create_r.json()["id"]

    del_r = await client.delete(f"/api/v1/automations/{automation_id}", headers=headers)
    assert del_r.status_code == 204

    list_r = await client.get(f"/api/v1/lists/{list_.id}/automations", headers=headers)
    assert list_r.json() == []


async def test_create_automation_requires_auth(client: AsyncClient, db, user, workspace, project, list_):
    """Unauthenticated request returns 403."""
    r = await client.post(
        f"/api/v1/lists/{list_.id}/automations",
        json={"trigger_type": "status_changed", "trigger_value": "x", "action_type": "set_priority", "action_value": "high"},
    )
    assert r.status_code == 403


async def test_create_automation_member_forbidden(client: AsyncClient, db, user, workspace, project, list_, headers):
    """Workspace member (not admin/owner) cannot create automation rules."""
    from app.models.workspace import WorkspaceMember, WorkspaceRole
    member_user = await make_user(db, "member@example.com")
    db.add(WorkspaceMember(workspace_id=workspace.id, user_id=member_user.id, role=WorkspaceRole.member))
    await db.commit()

    r = await client.post(
        f"/api/v1/lists/{list_.id}/automations",
        json={"trigger_type": "status_changed", "trigger_value": "x", "action_type": "set_priority", "action_value": "high"},
        headers=auth_headers(member_user),
    )
    assert r.status_code == 403


async def test_create_automation_non_member_forbidden(client: AsyncClient, db, user, workspace, project, list_, headers):
    """Non-member of workspace cannot create automations."""
    other = await make_user(db, "other@example.com")
    await db.commit()
    other_headers = auth_headers(other)

    r = await client.post(
        f"/api/v1/lists/{list_.id}/automations",
        json={"trigger_type": "status_changed", "trigger_value": "x", "action_type": "set_priority", "action_value": "high"},
        headers=other_headers,
    )
    assert r.status_code == 403


async def test_clear_assignees_action_value_is_null(client: AsyncClient, db, user, workspace, project, list_, headers):
    """clear_assignees action does not require action_value."""
    done = await make_status(db, list_)
    await db.commit()

    r = await client.post(
        f"/api/v1/lists/{list_.id}/automations",
        json={"trigger_type": "status_changed", "trigger_value": str(done.id), "action_type": "clear_assignees"},
        headers=headers,
    )
    assert r.status_code == 201
    assert r.json()["action_value"] is None


# ── Execution ─────────────────────────────────────────────────────────────────

async def test_status_changed_triggers_set_priority(client: AsyncClient, db, user, workspace, project, list_, headers):
    """When status changes to trigger value, priority is automatically updated."""
    done = await make_status(db, list_)
    await db.commit()

    # Create rule: status → Done ⇒ priority = urgent
    await client.post(
        f"/api/v1/lists/{list_.id}/automations",
        json={"trigger_type": "status_changed", "trigger_value": str(done.id), "action_type": "set_priority", "action_value": "urgent"},
        headers=headers,
    )

    task = await make_task(client, list_, headers)
    # Set status to "Done"
    await client.patch(f"/api/v1/tasks/{task['id']}", json={"status_id": str(done.id)}, headers=headers)

    r = await client.get(f"/api/v1/tasks/{task['id']}", headers=headers)
    assert r.json()["priority"] == "urgent"


async def test_priority_changed_triggers_set_status(client: AsyncClient, db, user, workspace, project, list_, headers):
    """When priority changes to trigger value, status is automatically updated."""
    urgent_status = await make_status(db, list_, name="Urgent", is_complete=False)
    await db.commit()

    # Rule: priority → urgent ⇒ set_status = urgent_status
    await client.post(
        f"/api/v1/lists/{list_.id}/automations",
        json={"trigger_type": "priority_changed", "trigger_value": "urgent", "action_type": "set_status", "action_value": str(urgent_status.id)},
        headers=headers,
    )

    task = await make_task(client, list_, headers)
    await client.patch(f"/api/v1/tasks/{task['id']}", json={"priority": "urgent"}, headers=headers)

    r = await client.get(f"/api/v1/tasks/{task['id']}", headers=headers)
    assert r.json()["status_id"] == str(urgent_status.id)


async def test_status_changed_triggers_assign_reviewer(client: AsyncClient, db, user, workspace, project, list_, headers):
    """When status changes to trigger value, reviewer is automatically set."""
    done = await make_status(db, list_)
    await db.commit()

    # Rule: status → Done ⇒ assign reviewer = user.id
    await client.post(
        f"/api/v1/lists/{list_.id}/automations",
        json={"trigger_type": "status_changed", "trigger_value": str(done.id), "action_type": "assign_reviewer", "action_value": str(user.id)},
        headers=headers,
    )

    task = await make_task(client, list_, headers)
    await client.patch(f"/api/v1/tasks/{task['id']}", json={"status_id": str(done.id)}, headers=headers)

    r = await client.get(f"/api/v1/tasks/{task['id']}", headers=headers)
    assert r.json()["reviewer_id"] == str(user.id)


async def test_status_changed_triggers_clear_assignees(client: AsyncClient, db, user, workspace, project, list_, headers):
    """When status changes to trigger value, assignees are cleared."""
    done = await make_status(db, list_)
    await db.commit()

    # Rule: status → Done ⇒ clear_assignees
    await client.post(
        f"/api/v1/lists/{list_.id}/automations",
        json={"trigger_type": "status_changed", "trigger_value": str(done.id), "action_type": "clear_assignees"},
        headers=headers,
    )

    task = await make_task(client, list_, headers)
    # Assign user first
    await client.patch(f"/api/v1/tasks/{task['id']}", json={"assignee_ids": [str(user.id)]}, headers=headers)

    # Trigger automation by changing status
    await client.patch(f"/api/v1/tasks/{task['id']}", json={"status_id": str(done.id)}, headers=headers)

    r = await client.get(f"/api/v1/tasks/{task['id']}", headers=headers)
    assert r.json()["assignee_ids"] == []


async def test_automation_not_triggered_on_different_status(client: AsyncClient, db, user, workspace, project, list_, headers):
    """Automation does not fire when a different status is set."""
    done = await make_status(db, list_, name="Done")
    in_progress = await make_status(db, list_, name="In Progress", is_complete=False)
    await db.commit()

    # Rule: status → Done ⇒ priority = urgent  (should NOT fire when In Progress is set)
    await client.post(
        f"/api/v1/lists/{list_.id}/automations",
        json={"trigger_type": "status_changed", "trigger_value": str(done.id), "action_type": "set_priority", "action_value": "urgent"},
        headers=headers,
    )

    task = await make_task(client, list_, headers)
    await client.patch(f"/api/v1/tasks/{task['id']}", json={"status_id": str(in_progress.id)}, headers=headers)

    r = await client.get(f"/api/v1/tasks/{task['id']}", headers=headers)
    assert r.json()["priority"] == "none"  # unchanged


async def test_automation_audit_log_created(client: AsyncClient, db, user, workspace, project, list_, headers):
    """An automation action writes an 'automation' entry to the audit log."""
    done = await make_status(db, list_)
    await db.commit()

    await client.post(
        f"/api/v1/lists/{list_.id}/automations",
        json={"trigger_type": "status_changed", "trigger_value": str(done.id), "action_type": "set_priority", "action_value": "urgent"},
        headers=headers,
    )

    task = await make_task(client, list_, headers)
    await client.patch(f"/api/v1/tasks/{task['id']}", json={"status_id": str(done.id)}, headers=headers)

    logs_r = await client.get(f"/api/v1/tasks/{task['id']}/audit", headers=headers)
    actions = [l["action"] for l in logs_r.json()]
    assert "automation" in actions
