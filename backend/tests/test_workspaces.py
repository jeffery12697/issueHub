import pytest
from tests.conftest import auth_headers, make_user, make_workspace


async def test_create_workspace(client, user, headers):
    r = await client.post("/api/v1/workspaces", json={"name": "Acme"}, headers=headers)
    assert r.status_code == 201
    assert r.json()["name"] == "Acme"


async def test_list_workspaces(client, workspace, headers):
    r = await client.get("/api/v1/workspaces", headers=headers)
    assert r.status_code == 200
    ids = [w["id"] for w in r.json()]
    assert str(workspace.id) in ids


async def test_get_workspace(client, workspace, headers):
    r = await client.get(f"/api/v1/workspaces/{workspace.id}", headers=headers)
    assert r.status_code == 200
    assert r.json()["name"] == workspace.name


async def test_get_workspace_not_member_returns_403(client, db, user):
    other = await make_user(db, "other@example.com")
    ws = await make_workspace(db, other, "Other WS")
    r = await client.get(f"/api/v1/workspaces/{ws.id}", headers=auth_headers(user))
    assert r.status_code == 403


async def test_update_workspace(client, workspace, headers):
    r = await client.patch(f"/api/v1/workspaces/{workspace.id}", json={"name": "Renamed"}, headers=headers)
    assert r.status_code == 200
    assert r.json()["name"] == "Renamed"


async def test_invite_member(client, db, workspace, headers):
    other = await make_user(db, "invite@example.com")
    r = await client.post(
        f"/api/v1/workspaces/{workspace.id}/members",
        json={"user_id": str(other.id), "role": "member"},
        headers=headers,
    )
    assert r.status_code == 201


async def test_invited_member_can_access_workspace(client, db, workspace, headers):
    other = await make_user(db, "newmember@example.com")
    await client.post(
        f"/api/v1/workspaces/{workspace.id}/members",
        json={"user_id": str(other.id), "role": "member"},
        headers=headers,
    )
    r = await client.get(f"/api/v1/workspaces/{workspace.id}", headers=auth_headers(other))
    assert r.status_code == 200


async def test_remove_member(client, db, workspace, headers):
    other = await make_user(db, "leave@example.com")
    await client.post(
        f"/api/v1/workspaces/{workspace.id}/members",
        json={"user_id": str(other.id), "role": "member"},
        headers=headers,
    )
    r = await client.delete(
        f"/api/v1/workspaces/{workspace.id}/members/{other.id}",
        headers=headers,
    )
    assert r.status_code == 204


async def test_requires_auth(client):
    r = await client.get("/api/v1/workspaces")
    assert r.status_code == 403
