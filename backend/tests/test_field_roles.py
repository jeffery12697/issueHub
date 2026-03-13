import pytest
from httpx import AsyncClient
from app.models.workspace import WorkspaceMember, WorkspaceRole
from tests.conftest import make_user, make_task, auth_headers


async def test_field_hidden_from_member(client: AsyncClient, db, user, workspace, project, list_, headers):
    """A field with visibility_roles=['admin'] is not returned to a member."""
    # Create field visible only to admin
    cf_resp = await client.post(
        f"/api/v1/lists/{list_.id}/custom-fields",
        json={"name": "Secret", "field_type": "text", "visibility_roles": ["admin"]},
        headers=headers,
    )
    assert cf_resp.status_code == 201
    field_id = cf_resp.json()["id"]

    # Create a member user
    member = await make_user(db, "member@example.com")
    db.add(WorkspaceMember(workspace_id=workspace.id, user_id=member.id, role=WorkspaceRole.member))
    await db.commit()
    member_headers = auth_headers(member)

    # Member should not see the field
    resp = await client.get(f"/api/v1/lists/{list_.id}/custom-fields", headers=member_headers)
    assert resp.status_code == 200
    ids = [f["id"] for f in resp.json()]
    assert field_id not in ids


async def test_field_visible_to_all_when_no_roles(client: AsyncClient, db, user, workspace, project, list_, headers):
    """A field with empty visibility_roles is visible to everyone."""
    cf_resp = await client.post(
        f"/api/v1/lists/{list_.id}/custom-fields",
        json={"name": "Public Field", "field_type": "text", "visibility_roles": []},
        headers=headers,
    )
    assert cf_resp.status_code == 201
    field_id = cf_resp.json()["id"]

    member = await make_user(db, "member2@example.com")
    db.add(WorkspaceMember(workspace_id=workspace.id, user_id=member.id, role=WorkspaceRole.member))
    await db.commit()
    member_headers = auth_headers(member)

    resp = await client.get(f"/api/v1/lists/{list_.id}/custom-fields", headers=member_headers)
    assert resp.status_code == 200
    ids = [f["id"] for f in resp.json()]
    assert field_id in ids


async def test_field_not_editable_by_member(client: AsyncClient, db, user, workspace, project, list_, headers):
    """A field with editable_roles=['admin'] cannot be written by a member."""
    cf_resp = await client.post(
        f"/api/v1/lists/{list_.id}/custom-fields",
        json={"name": "Admin Only", "field_type": "text", "editable_roles": ["admin", "owner"]},
        headers=headers,
    )
    assert cf_resp.status_code == 201
    field_id = cf_resp.json()["id"]

    member = await make_user(db, "member3@example.com")
    db.add(WorkspaceMember(workspace_id=workspace.id, user_id=member.id, role=WorkspaceRole.member))
    await db.commit()
    member_headers = auth_headers(member)

    task = await make_task(client, list_, headers)
    resp = await client.put(
        f"/api/v1/tasks/{task['id']}/field-values",
        json={"values": {field_id: "some value"}},
        headers=member_headers,
    )
    assert resp.status_code == 403
