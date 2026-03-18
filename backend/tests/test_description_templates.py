"""Tests for description templates feature."""
import pytest
from tests.conftest import make_user, make_workspace, auth_headers


SAMPLE_CONTENT = "<h2>Bug Report</h2><p><strong>Steps to reproduce:</strong></p><ol><li><p></p></li></ol>"


async def test_create_template(client, workspace, headers):
    r = await client.post(
        f"/api/v1/workspaces/{workspace.id}/description-templates",
        json={"name": "Bug Report", "content": SAMPLE_CONTENT},
        headers=headers,
    )
    assert r.status_code == 201
    data = r.json()
    assert data["name"] == "Bug Report"
    assert data["content"] == SAMPLE_CONTENT
    assert data["workspace_id"] == str(workspace.id)


async def test_create_template_empty_content(client, workspace, headers):
    r = await client.post(
        f"/api/v1/workspaces/{workspace.id}/description-templates",
        json={"name": "Blank Template"},
        headers=headers,
    )
    assert r.status_code == 201
    assert r.json()["content"] == ""


async def test_list_templates(client, workspace, headers):
    await client.post(
        f"/api/v1/workspaces/{workspace.id}/description-templates",
        json={"name": "Template A", "content": ""},
        headers=headers,
    )
    await client.post(
        f"/api/v1/workspaces/{workspace.id}/description-templates",
        json={"name": "Template B", "content": ""},
        headers=headers,
    )
    r = await client.get(
        f"/api/v1/workspaces/{workspace.id}/description-templates",
        headers=headers,
    )
    assert r.status_code == 200
    names = [t["name"] for t in r.json()]
    assert "Template A" in names
    assert "Template B" in names


async def test_update_template(client, workspace, headers):
    created = (await client.post(
        f"/api/v1/workspaces/{workspace.id}/description-templates",
        json={"name": "Old Name", "content": "old"},
        headers=headers,
    )).json()

    r = await client.patch(
        f"/api/v1/workspaces/{workspace.id}/description-templates/{created['id']}",
        json={"name": "New Name", "content": "<p>new content</p>"},
        headers=headers,
    )
    assert r.status_code == 200
    data = r.json()
    assert data["name"] == "New Name"
    assert data["content"] == "<p>new content</p>"


async def test_delete_template(client, workspace, headers):
    created = (await client.post(
        f"/api/v1/workspaces/{workspace.id}/description-templates",
        json={"name": "To Delete", "content": ""},
        headers=headers,
    )).json()

    r = await client.delete(
        f"/api/v1/workspaces/{workspace.id}/description-templates/{created['id']}",
        headers=headers,
    )
    assert r.status_code == 204

    list_r = await client.get(
        f"/api/v1/workspaces/{workspace.id}/description-templates",
        headers=headers,
    )
    ids = [t["id"] for t in list_r.json()]
    assert created["id"] not in ids


async def test_non_admin_cannot_create(client, workspace, db, headers):
    """Members (not admin/owner) cannot create templates."""
    member = await make_user(db, email="member@example.com")
    # Add as regular member
    from app.models.workspace import WorkspaceMember, WorkspaceRole
    db.add(WorkspaceMember(workspace_id=workspace.id, user_id=member.id, role=WorkspaceRole.member))
    await db.flush()

    member_headers = auth_headers(member)
    r = await client.post(
        f"/api/v1/workspaces/{workspace.id}/description-templates",
        json={"name": "Forbidden", "content": ""},
        headers=member_headers,
    )
    assert r.status_code == 403


async def test_non_admin_cannot_delete(client, workspace, db, headers):
    created = (await client.post(
        f"/api/v1/workspaces/{workspace.id}/description-templates",
        json={"name": "Protected", "content": ""},
        headers=headers,
    )).json()

    member = await make_user(db, email="member2@example.com")
    from app.models.workspace import WorkspaceMember, WorkspaceRole
    db.add(WorkspaceMember(workspace_id=workspace.id, user_id=member.id, role=WorkspaceRole.member))
    await db.flush()

    member_headers = auth_headers(member)
    r = await client.delete(
        f"/api/v1/workspaces/{workspace.id}/description-templates/{created['id']}",
        headers=member_headers,
    )
    assert r.status_code == 403


async def test_member_can_list(client, workspace, db, headers):
    """Regular members can read templates (needed for task page)."""
    await client.post(
        f"/api/v1/workspaces/{workspace.id}/description-templates",
        json={"name": "Readable", "content": ""},
        headers=headers,
    )

    member = await make_user(db, email="reader@example.com")
    from app.models.workspace import WorkspaceMember, WorkspaceRole
    db.add(WorkspaceMember(workspace_id=workspace.id, user_id=member.id, role=WorkspaceRole.member))
    await db.flush()

    member_headers = auth_headers(member)
    r = await client.get(
        f"/api/v1/workspaces/{workspace.id}/description-templates",
        headers=member_headers,
    )
    assert r.status_code == 200
    assert any(t["name"] == "Readable" for t in r.json())


async def test_unauthenticated_cannot_list(client, workspace):
    r = await client.get(
        f"/api/v1/workspaces/{workspace.id}/description-templates",
    )
    assert r.status_code == 403


async def test_update_nonexistent_template(client, workspace, headers):
    import uuid
    r = await client.patch(
        f"/api/v1/workspaces/{workspace.id}/description-templates/{uuid.uuid4()}",
        json={"name": "Ghost"},
        headers=headers,
    )
    assert r.status_code == 404
