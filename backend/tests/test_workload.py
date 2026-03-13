import pytest
from httpx import AsyncClient
from app.models.workspace import WorkspaceMember, WorkspaceRole
from tests.conftest import make_user, auth_headers


async def test_workload_returns_tasks_for_member(client: AsyncClient, db, user, workspace, project, list_, headers):
    # Create task and assign to user
    task_r = await client.post(
        f"/api/v1/lists/{list_.id}/tasks",
        json={"title": "Assigned task", "assignee_ids": [str(user.id)]},
        headers=headers,
    )
    assert task_r.status_code == 201

    r = await client.get(f"/api/v1/workspaces/{workspace.id}/workload", headers=headers)
    assert r.status_code == 200
    data = r.json()

    user_entry = next((m for m in data if m["user_id"] == str(user.id)), None)
    assert user_entry is not None
    assert user_entry["open_task_count"] == 1


async def test_workload_empty_for_no_tasks(client: AsyncClient, db, user, workspace, project, list_, headers):
    # Add a second member with no tasks
    member2 = await make_user(db, "member2@example.com")
    db.add(WorkspaceMember(workspace_id=workspace.id, user_id=member2.id, role=WorkspaceRole.member))
    await db.commit()

    r = await client.get(f"/api/v1/workspaces/{workspace.id}/workload", headers=headers)
    assert r.status_code == 200
    data = r.json()

    member2_entry = next((m for m in data if m["user_id"] == str(member2.id)), None)
    assert member2_entry is not None
    assert member2_entry["open_task_count"] == 0


async def test_workload_non_member_forbidden(client: AsyncClient, db, user, workspace, project, list_, headers):
    other = await make_user(db, "other@example.com")
    await db.commit()
    other_headers = auth_headers(other)

    r = await client.get(f"/api/v1/workspaces/{workspace.id}/workload", headers=other_headers)
    assert r.status_code == 403
