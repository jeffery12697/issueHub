import pytest
from tests.conftest import auth_headers, make_user, make_workspace


async def test_create_project(client, workspace, headers):
    r = await client.post(
        f"/api/v1/workspaces/{workspace.id}/projects",
        json={"name": "Alpha"},
        headers=headers,
    )
    assert r.status_code == 201
    assert r.json()["name"] == "Alpha"
    assert r.json()["workspace_id"] == str(workspace.id)


async def test_list_projects(client, project, workspace, headers):
    r = await client.get(f"/api/v1/workspaces/{workspace.id}/projects", headers=headers)
    assert r.status_code == 200
    ids = [p["id"] for p in r.json()]
    assert str(project.id) in ids


async def test_get_project(client, project, headers):
    r = await client.get(f"/api/v1/projects/{project.id}", headers=headers)
    assert r.status_code == 200
    assert r.json()["id"] == str(project.id)


async def test_update_project(client, project, headers):
    r = await client.patch(
        f"/api/v1/projects/{project.id}",
        json={"name": "Beta"},
        headers=headers,
    )
    assert r.status_code == 200
    assert r.json()["name"] == "Beta"


async def test_delete_project(client, project, workspace, headers):
    r = await client.delete(f"/api/v1/projects/{project.id}", headers=headers)
    assert r.status_code == 204
    r2 = await client.get(f"/api/v1/workspaces/{workspace.id}/projects", headers=headers)
    ids = [p["id"] for p in r2.json()]
    assert str(project.id) not in ids


async def test_non_member_cannot_create_project(client, db, workspace):
    stranger = await make_user(db, "stranger@example.com")
    r = await client.post(
        f"/api/v1/workspaces/{workspace.id}/projects",
        json={"name": "Hack"},
        headers=auth_headers(stranger),
    )
    assert r.status_code == 403
