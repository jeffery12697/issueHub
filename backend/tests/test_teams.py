"""Tests for Teams feature (M-01, M-03, M-04)."""
import pytest
from tests.conftest import auth_headers, make_user, make_workspace, make_project, make_list


# ── Team CRUD ─────────────────────────────────────────────────────────────────

async def test_create_team(client, workspace, headers):
    r = await client.post(
        f"/api/v1/workspaces/{workspace.id}/teams",
        json={"name": "Engineering"},
        headers=headers,
    )
    assert r.status_code == 201
    data = r.json()
    assert data["name"] == "Engineering"
    assert data["workspace_id"] == str(workspace.id)


async def test_create_team_requires_admin(client, db, workspace):
    member_user = await make_user(db, "member@example.com")
    # Add as regular member
    owner_headers = auth_headers(await make_user(db, "owner2@example.com"))
    # Use existing workspace owner (user fixture)
    member_headers = auth_headers(member_user)

    # First add the member to the workspace
    from app.models.workspace import WorkspaceMember, WorkspaceRole
    db.add(WorkspaceMember(workspace_id=workspace.id, user_id=member_user.id, role=WorkspaceRole.member))
    await db.flush()

    r = await client.post(
        f"/api/v1/workspaces/{workspace.id}/teams",
        json={"name": "Devs"},
        headers=member_headers,
    )
    assert r.status_code == 403


async def test_list_teams(client, workspace, headers):
    # Create a team first
    await client.post(
        f"/api/v1/workspaces/{workspace.id}/teams",
        json={"name": "Design"},
        headers=headers,
    )
    r = await client.get(f"/api/v1/workspaces/{workspace.id}/teams", headers=headers)
    assert r.status_code == 200
    names = [t["name"] for t in r.json()]
    assert "Design" in names


async def test_delete_team(client, workspace, headers):
    create_r = await client.post(
        f"/api/v1/workspaces/{workspace.id}/teams",
        json={"name": "ToDelete"},
        headers=headers,
    )
    team_id = create_r.json()["id"]

    del_r = await client.delete(
        f"/api/v1/workspaces/{workspace.id}/teams/{team_id}",
        headers=headers,
    )
    assert del_r.status_code == 204

    # Should not appear in list
    list_r = await client.get(f"/api/v1/workspaces/{workspace.id}/teams", headers=headers)
    ids = [t["id"] for t in list_r.json()]
    assert team_id not in ids


# ── Team members ──────────────────────────────────────────────────────────────

async def test_add_member_to_team(client, db, workspace, headers):
    other = await make_user(db, "teammate@example.com")
    # Add other to workspace first
    from app.models.workspace import WorkspaceMember, WorkspaceRole
    db.add(WorkspaceMember(workspace_id=workspace.id, user_id=other.id, role=WorkspaceRole.member))
    await db.flush()

    create_r = await client.post(
        f"/api/v1/workspaces/{workspace.id}/teams",
        json={"name": "Alpha"},
        headers=headers,
    )
    team_id = create_r.json()["id"]

    add_r = await client.post(
        f"/api/v1/workspaces/{workspace.id}/teams/{team_id}/members",
        json={"user_id": str(other.id), "role": "team_member"},
        headers=headers,
    )
    assert add_r.status_code == 201
    data = add_r.json()
    assert data["user_id"] == str(other.id)
    assert data["role"] == "team_member"


async def test_list_team_members(client, db, workspace, headers):
    other = await make_user(db, "listed@example.com")
    from app.models.workspace import WorkspaceMember, WorkspaceRole
    db.add(WorkspaceMember(workspace_id=workspace.id, user_id=other.id, role=WorkspaceRole.member))
    await db.flush()

    create_r = await client.post(
        f"/api/v1/workspaces/{workspace.id}/teams",
        json={"name": "Beta"},
        headers=headers,
    )
    team_id = create_r.json()["id"]

    await client.post(
        f"/api/v1/workspaces/{workspace.id}/teams/{team_id}/members",
        json={"user_id": str(other.id), "role": "team_admin"},
        headers=headers,
    )

    list_r = await client.get(
        f"/api/v1/workspaces/{workspace.id}/teams/{team_id}/members",
        headers=headers,
    )
    assert list_r.status_code == 200
    user_ids = [m["user_id"] for m in list_r.json()]
    assert str(other.id) in user_ids


async def test_remove_member_from_team(client, db, workspace, headers):
    other = await make_user(db, "removeme@example.com")
    from app.models.workspace import WorkspaceMember, WorkspaceRole
    db.add(WorkspaceMember(workspace_id=workspace.id, user_id=other.id, role=WorkspaceRole.member))
    await db.flush()

    create_r = await client.post(
        f"/api/v1/workspaces/{workspace.id}/teams",
        json={"name": "Gamma"},
        headers=headers,
    )
    team_id = create_r.json()["id"]

    await client.post(
        f"/api/v1/workspaces/{workspace.id}/teams/{team_id}/members",
        json={"user_id": str(other.id), "role": "team_member"},
        headers=headers,
    )

    del_r = await client.delete(
        f"/api/v1/workspaces/{workspace.id}/teams/{team_id}/members/{other.id}",
        headers=headers,
    )
    assert del_r.status_code == 204

    list_r = await client.get(
        f"/api/v1/workspaces/{workspace.id}/teams/{team_id}/members",
        headers=headers,
    )
    user_ids = [m["user_id"] for m in list_r.json()]
    assert str(other.id) not in user_ids


# ── List visibility ───────────────────────────────────────────────────────────

async def test_list_visibility_hidden_from_non_member(client, db, workspace, project, list_, headers):
    """A list restricted to a team should be hidden from users not in that team."""
    non_member_user = await make_user(db, "outsider@example.com")
    from app.models.workspace import WorkspaceMember, WorkspaceRole
    db.add(WorkspaceMember(workspace_id=workspace.id, user_id=non_member_user.id, role=WorkspaceRole.member))
    await db.flush()

    # Create a team
    create_r = await client.post(
        f"/api/v1/workspaces/{workspace.id}/teams",
        json={"name": "SecretTeam"},
        headers=headers,
    )
    team_id = create_r.json()["id"]

    # Restrict the list to this team
    vis_r = await client.patch(
        f"/api/v1/lists/{list_.id}/visibility",
        json={"team_ids": [team_id]},
        headers=headers,
    )
    assert vis_r.status_code == 200

    # Non-member of team should not see the list
    nm_headers = auth_headers(non_member_user)
    lists_r = await client.get(f"/api/v1/projects/{project.id}/lists", headers=nm_headers)
    assert lists_r.status_code == 200
    ids = [l["id"] for l in lists_r.json()]
    assert str(list_.id) not in ids


async def test_list_visibility_visible_to_team_member(client, db, workspace, project, list_, headers):
    """A list restricted to a team should be visible to users who are in that team."""
    team_user = await make_user(db, "teamplayer@example.com")
    from app.models.workspace import WorkspaceMember, WorkspaceRole
    db.add(WorkspaceMember(workspace_id=workspace.id, user_id=team_user.id, role=WorkspaceRole.member))
    await db.flush()

    # Create a team
    create_r = await client.post(
        f"/api/v1/workspaces/{workspace.id}/teams",
        json={"name": "VisTeam"},
        headers=headers,
    )
    team_id = create_r.json()["id"]

    # Add team_user to the team
    await client.post(
        f"/api/v1/workspaces/{workspace.id}/teams/{team_id}/members",
        json={"user_id": str(team_user.id), "role": "team_member"},
        headers=headers,
    )

    # Restrict the list to this team
    await client.patch(
        f"/api/v1/lists/{list_.id}/visibility",
        json={"team_ids": [team_id]},
        headers=headers,
    )

    # Team member should see the list
    tm_headers = auth_headers(team_user)
    lists_r = await client.get(f"/api/v1/projects/{project.id}/lists", headers=tm_headers)
    assert lists_r.status_code == 200
    ids = [l["id"] for l in lists_r.json()]
    assert str(list_.id) in ids


async def test_list_visibility_visible_to_workspace_admin(client, db, workspace, project, list_, headers):
    """A workspace admin can see all lists regardless of team_ids."""
    admin_user = await make_user(db, "admin@example.com")
    from app.models.workspace import WorkspaceMember, WorkspaceRole
    db.add(WorkspaceMember(workspace_id=workspace.id, user_id=admin_user.id, role=WorkspaceRole.admin))
    await db.flush()

    # Create a team and restrict the list
    create_r = await client.post(
        f"/api/v1/workspaces/{workspace.id}/teams",
        json={"name": "AdminBypassTeam"},
        headers=headers,
    )
    team_id = create_r.json()["id"]

    await client.patch(
        f"/api/v1/lists/{list_.id}/visibility",
        json={"team_ids": [team_id]},
        headers=headers,
    )

    # Admin not in the team should still see the list
    admin_headers = auth_headers(admin_user)
    lists_r = await client.get(f"/api/v1/projects/{project.id}/lists", headers=admin_headers)
    assert lists_r.status_code == 200
    ids = [l["id"] for l in lists_r.json()]
    assert str(list_.id) in ids
