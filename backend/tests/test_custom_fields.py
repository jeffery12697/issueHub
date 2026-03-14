"""Tests for custom field definitions and values (C-01, C-02, C-03)."""
import pytest
from tests.conftest import make_user, make_workspace, make_project, make_list, auth_headers


# ── helpers ───────────────────────────────────────────────────────────────────

async def make_task(client, list_, headers):
    r = await client.post(
        f"/api/v1/lists/{list_.id}/tasks",
        json={"title": "Test Task"},
        headers=headers,
    )
    assert r.status_code == 201
    return r.json()


# ── tests ─────────────────────────────────────────────────────────────────────

async def test_create_field(client, list_, headers):
    r = await client.post(
        f"/api/v1/lists/{list_.id}/custom-fields",
        json={"name": "Notes", "field_type": "text"},
        headers=headers,
    )
    assert r.status_code == 201
    data = r.json()
    assert data["name"] == "Notes"
    assert data["field_type"] == "text"
    assert data["is_required"] is False
    assert data["list_id"] == str(list_.id)
    assert data["order_index"] > 0


async def test_list_fields(client, list_, headers):
    await client.post(
        f"/api/v1/lists/{list_.id}/custom-fields",
        json={"name": "Field A", "field_type": "text"},
        headers=headers,
    )
    await client.post(
        f"/api/v1/lists/{list_.id}/custom-fields",
        json={"name": "Field B", "field_type": "number"},
        headers=headers,
    )
    r = await client.get(
        f"/api/v1/lists/{list_.id}/custom-fields",
        headers=headers,
    )
    assert r.status_code == 200
    names = [f["name"] for f in r.json()]
    assert "Field A" in names
    assert "Field B" in names


async def test_create_field_dropdown(client, list_, headers):
    r = await client.post(
        f"/api/v1/lists/{list_.id}/custom-fields",
        json={
            "name": "Priority Level",
            "field_type": "dropdown",
            "options_json": ["Low", "Medium", "High"],
        },
        headers=headers,
    )
    assert r.status_code == 201
    data = r.json()
    assert data["field_type"] == "dropdown"
    assert data["options_json"] == ["Low", "Medium", "High"]


async def test_update_field(client, list_, headers):
    field = (await client.post(
        f"/api/v1/lists/{list_.id}/custom-fields",
        json={"name": "Old Name", "field_type": "text"},
        headers=headers,
    )).json()
    r = await client.patch(
        f"/api/v1/lists/{list_.id}/custom-fields/{field['id']}",
        json={"name": "New Name", "is_required": True},
        headers=headers,
    )
    assert r.status_code == 200
    data = r.json()
    assert data["name"] == "New Name"
    assert data["is_required"] is True


async def test_delete_field(client, list_, headers):
    field = (await client.post(
        f"/api/v1/lists/{list_.id}/custom-fields",
        json={"name": "To Delete", "field_type": "text"},
        headers=headers,
    )).json()
    r = await client.delete(
        f"/api/v1/lists/{list_.id}/custom-fields/{field['id']}",
        headers=headers,
    )
    assert r.status_code == 204
    # Should not appear in list anymore
    fields_r = await client.get(
        f"/api/v1/lists/{list_.id}/custom-fields",
        headers=headers,
    )
    ids = [f["id"] for f in fields_r.json()]
    assert field["id"] not in ids


async def test_upsert_field_values(client, list_, headers):
    field = (await client.post(
        f"/api/v1/lists/{list_.id}/custom-fields",
        json={"name": "Description", "field_type": "text"},
        headers=headers,
    )).json()
    task = await make_task(client, list_, headers)

    r = await client.put(
        f"/api/v1/tasks/{task['id']}/field-values",
        json={"values": {field["id"]: "Hello World"}},
        headers=headers,
    )
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 1
    assert data[0]["value_text"] == "Hello World"
    assert data[0]["field_id"] == field["id"]

    # Retrieve and verify
    get_r = await client.get(
        f"/api/v1/tasks/{task['id']}/field-values",
        headers=headers,
    )
    assert get_r.status_code == 200
    assert get_r.json()[0]["value_text"] == "Hello World"


async def test_upsert_multiple_field_types(client, list_, headers):
    num_field = (await client.post(
        f"/api/v1/lists/{list_.id}/custom-fields",
        json={"name": "Score", "field_type": "number"},
        headers=headers,
    )).json()
    bool_field = (await client.post(
        f"/api/v1/lists/{list_.id}/custom-fields",
        json={"name": "Active", "field_type": "checkbox"},
        headers=headers,
    )).json()
    text_field = (await client.post(
        f"/api/v1/lists/{list_.id}/custom-fields",
        json={"name": "Notes", "field_type": "text"},
        headers=headers,
    )).json()

    task = await make_task(client, list_, headers)

    r = await client.put(
        f"/api/v1/tasks/{task['id']}/field-values",
        json={"values": {
            num_field["id"]: 42.5,
            bool_field["id"]: True,
            text_field["id"]: "Some note",
        }},
        headers=headers,
    )
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 3

    by_field = {v["field_id"]: v for v in data}
    assert by_field[num_field["id"]]["value_number"] == 42.5
    assert by_field[bool_field["id"]]["value_boolean"] is True
    assert by_field[text_field["id"]]["value_text"] == "Some note"


async def test_required_field_validation(client, list_, headers):
    await client.post(
        f"/api/v1/lists/{list_.id}/custom-fields",
        json={"name": "Required Field", "field_type": "text", "is_required": True},
        headers=headers,
    )
    task = await make_task(client, list_, headers)

    # Try to upsert without providing the required field
    r = await client.put(
        f"/api/v1/tasks/{task['id']}/field-values",
        json={"values": {}},
        headers=headers,
    )
    assert r.status_code == 422
    assert "Required fields missing" in r.json()["detail"]


async def test_required_field_passes_when_provided(client, list_, headers):
    field = (await client.post(
        f"/api/v1/lists/{list_.id}/custom-fields",
        json={"name": "Must Have", "field_type": "text", "is_required": True},
        headers=headers,
    )).json()
    task = await make_task(client, list_, headers)

    r = await client.put(
        f"/api/v1/tasks/{task['id']}/field-values",
        json={"values": {field["id"]: "provided value"}},
        headers=headers,
    )
    assert r.status_code == 200


async def test_create_field_unauthenticated(client, list_):
    r = await client.post(
        f"/api/v1/lists/{list_.id}/custom-fields",
        json={"name": "Secret", "field_type": "text"},
    )
    assert r.status_code == 403


async def test_create_field_member_forbidden(client, list_, db, workspace):
    """Workspace member (not admin/owner) cannot create custom fields."""
    from app.models.workspace import WorkspaceMember, WorkspaceRole
    member_user = await make_user(db, email="member@example.com")
    db.add(WorkspaceMember(workspace_id=workspace.id, user_id=member_user.id, role=WorkspaceRole.member))
    await db.commit()

    r = await client.post(
        f"/api/v1/lists/{list_.id}/custom-fields",
        json={"name": "Notes", "field_type": "text"},
        headers=auth_headers(member_user),
    )
    assert r.status_code == 403


async def test_create_field_non_member(client, list_, db):
    other_user = await make_user(db, email="other@example.com")
    other_ws = await make_workspace(db, other_user, name="Other WS")
    other_project = await make_project(db, other_ws)
    other_list = await make_list(db, other_project)

    r = await client.post(
        f"/api/v1/lists/{other_list.id}/custom-fields",
        json={"name": "Sneaky", "field_type": "text"},
        headers=auth_headers(other_user),
    )
    # other_user is a member of other_ws but we're using the fixture user's token
    # Actually let's use a user with NO membership at all
    no_member_user = await make_user(db, email="nomember@example.com")
    r2 = await client.post(
        f"/api/v1/lists/{list_.id}/custom-fields",
        json={"name": "Sneaky", "field_type": "text"},
        headers=auth_headers(no_member_user),
    )
    assert r2.status_code == 403
