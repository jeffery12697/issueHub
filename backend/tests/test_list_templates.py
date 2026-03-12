"""Tests for list templates (S-06)."""
import pytest
from tests.conftest import make_user, make_workspace, make_project, auth_headers


DEFAULT_STATUSES = [
    {"name": "To Do", "color": "#6b7280", "is_complete": False, "category": "not_started", "order_index": 100},
    {"name": "In Progress", "color": "#3b82f6", "is_complete": False, "category": "active", "order_index": 200},
    {"name": "Done", "color": "#22c55e", "is_complete": True, "category": "done", "order_index": 300},
]


async def test_create_template(client, workspace, headers):
    r = await client.post(
        f"/api/v1/workspaces/{workspace.id}/list-templates",
        json={"name": "Dev Template", "default_statuses": DEFAULT_STATUSES},
        headers=headers,
    )
    assert r.status_code == 201
    data = r.json()
    assert data["name"] == "Dev Template"
    assert data["workspace_id"] == str(workspace.id)
    assert len(data["default_statuses"]) == 3


async def test_list_templates(client, workspace, headers):
    await client.post(
        f"/api/v1/workspaces/{workspace.id}/list-templates",
        json={"name": "Template 1", "default_statuses": []},
        headers=headers,
    )
    await client.post(
        f"/api/v1/workspaces/{workspace.id}/list-templates",
        json={"name": "Template 2", "default_statuses": []},
        headers=headers,
    )
    r = await client.get(
        f"/api/v1/workspaces/{workspace.id}/list-templates",
        headers=headers,
    )
    assert r.status_code == 200
    names = [t["name"] for t in r.json()]
    assert "Template 1" in names
    assert "Template 2" in names


async def test_delete_template(client, workspace, headers):
    template = (await client.post(
        f"/api/v1/workspaces/{workspace.id}/list-templates",
        json={"name": "Temp", "default_statuses": []},
        headers=headers,
    )).json()
    r = await client.delete(
        f"/api/v1/workspaces/{workspace.id}/list-templates/{template['id']}",
        headers=headers,
    )
    assert r.status_code == 204
    # Should not appear in list anymore
    list_r = await client.get(
        f"/api/v1/workspaces/{workspace.id}/list-templates",
        headers=headers,
    )
    ids = [t["id"] for t in list_r.json()]
    assert template["id"] not in ids


async def test_create_list_from_template(client, workspace, project, headers):
    template = (await client.post(
        f"/api/v1/workspaces/{workspace.id}/list-templates",
        json={"name": "Sprint Template", "default_statuses": DEFAULT_STATUSES},
        headers=headers,
    )).json()

    r = await client.post(
        f"/api/v1/projects/{project.id}/lists/from-template",
        json={"name": "Sprint 1", "template_id": template["id"]},
        headers=headers,
    )
    assert r.status_code == 201
    data = r.json()
    assert data["name"] == "Sprint 1"
    assert data["project_id"] == str(project.id)

    # Check statuses were created
    list_id = data["id"]
    statuses_r = await client.get(
        f"/api/v1/lists/{list_id}/statuses",
        headers=headers,
    )
    assert statuses_r.status_code == 200
    status_names = [s["name"] for s in statuses_r.json()]
    assert "To Do" in status_names
    assert "In Progress" in status_names
    assert "Done" in status_names


async def test_create_list_from_template_unauthenticated(client, project, workspace, headers):
    template = (await client.post(
        f"/api/v1/workspaces/{workspace.id}/list-templates",
        json={"name": "My Template", "default_statuses": []},
        headers=headers,
    )).json()

    r = await client.post(
        f"/api/v1/projects/{project.id}/lists/from-template",
        json={"name": "New List", "template_id": template["id"]},
        # No auth headers
    )
    assert r.status_code == 403
