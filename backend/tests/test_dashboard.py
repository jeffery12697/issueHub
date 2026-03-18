"""Tests for R-01 Dashboard Widgets API."""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_list_widgets_empty(client: AsyncClient, workspace, headers):
    """Admin sees empty list when no widgets exist."""
    r = await client.get(
        f"/api/v1/workspaces/{workspace.id}/dashboard", headers=headers
    )
    assert r.status_code == 200
    assert r.json() == []


@pytest.mark.asyncio
async def test_create_widget(client: AsyncClient, workspace, headers):
    """Admin can create a widget."""
    r = await client.post(
        f"/api/v1/workspaces/{workspace.id}/dashboard/widgets",
        headers=headers,
        json={"widget_type": "overdue_count", "visible_to_members": True},
    )
    assert r.status_code == 201
    data = r.json()
    assert data["widget_type"] == "overdue_count"
    assert data["visible_to_members"] is True
    assert data["workspace_id"] == str(workspace.id)


@pytest.mark.asyncio
async def test_update_widget(client: AsyncClient, workspace, headers):
    """Admin can update visible_to_members and config."""
    create_r = await client.post(
        f"/api/v1/workspaces/{workspace.id}/dashboard/widgets",
        headers=headers,
        json={"widget_type": "completion_rate"},
    )
    widget_id = create_r.json()["id"]

    patch_r = await client.patch(
        f"/api/v1/workspaces/{workspace.id}/dashboard/widgets/{widget_id}",
        headers=headers,
        json={"visible_to_members": True},
    )
    assert patch_r.status_code == 200
    assert patch_r.json()["visible_to_members"] is True


@pytest.mark.asyncio
async def test_delete_widget(client: AsyncClient, workspace, headers):
    """Admin can delete a widget."""
    create_r = await client.post(
        f"/api/v1/workspaces/{workspace.id}/dashboard/widgets",
        headers=headers,
        json={"widget_type": "member_workload"},
    )
    widget_id = create_r.json()["id"]

    del_r = await client.delete(
        f"/api/v1/workspaces/{workspace.id}/dashboard/widgets/{widget_id}",
        headers=headers,
    )
    assert del_r.status_code == 204

    list_r = await client.get(
        f"/api/v1/workspaces/{workspace.id}/dashboard", headers=headers
    )
    assert all(w["id"] != widget_id for w in list_r.json())


@pytest.mark.asyncio
async def test_member_sees_only_visible_widgets(
    client: AsyncClient, workspace, headers, db
):
    """Non-admin member sees only widgets with visible_to_members=True."""
    from tests.conftest import make_user, auth_headers

    member = await make_user(db, email="member@test.com")
    from app.features.workspaces.schemas import InviteMemberDTO
    from app.features.workspaces.repository import WorkspaceRepository

    ws_repo = WorkspaceRepository(db)
    await ws_repo.add_member(
        InviteMemberDTO(
            workspace_id=workspace.id,
            user_id=member.id,
            role="member",
            invited_by=None,
        )
    )
    await db.commit()
    member_headers = auth_headers(member)

    # Create two widgets: one visible, one not
    await client.post(
        f"/api/v1/workspaces/{workspace.id}/dashboard/widgets",
        headers=headers,
        json={"widget_type": "overdue_count", "visible_to_members": True},
    )
    await client.post(
        f"/api/v1/workspaces/{workspace.id}/dashboard/widgets",
        headers=headers,
        json={"widget_type": "completion_rate", "visible_to_members": False},
    )

    member_r = await client.get(
        f"/api/v1/workspaces/{workspace.id}/dashboard", headers=member_headers
    )
    assert member_r.status_code == 200
    visible = member_r.json()
    assert len(visible) == 1
    assert visible[0]["widget_type"] == "overdue_count"


@pytest.mark.asyncio
async def test_non_member_forbidden(client: AsyncClient, workspace):
    """Unauthenticated or non-member gets 403."""
    r = await client.get(f"/api/v1/workspaces/{workspace.id}/dashboard")
    assert r.status_code in (401, 403)


@pytest.mark.asyncio
async def test_widget_data_overdue(client: AsyncClient, workspace, headers):
    """Overdue count widget data endpoint returns expected shape."""
    create_r = await client.post(
        f"/api/v1/workspaces/{workspace.id}/dashboard/widgets",
        headers=headers,
        json={"widget_type": "overdue_count"},
    )
    widget_id = create_r.json()["id"]

    data_r = await client.get(
        f"/api/v1/workspaces/{workspace.id}/dashboard/widgets/{widget_id}/data",
        headers=headers,
    )
    assert data_r.status_code == 200
    assert "count" in data_r.json()


@pytest.mark.asyncio
async def test_widget_data_completion_rate(client: AsyncClient, workspace, headers):
    """Completion rate widget data endpoint returns expected shape."""
    create_r = await client.post(
        f"/api/v1/workspaces/{workspace.id}/dashboard/widgets",
        headers=headers,
        json={"widget_type": "completion_rate"},
    )
    widget_id = create_r.json()["id"]

    data_r = await client.get(
        f"/api/v1/workspaces/{workspace.id}/dashboard/widgets/{widget_id}/data",
        headers=headers,
    )
    assert data_r.status_code == 200
    body = data_r.json()
    assert "total" in body
    assert "done" in body
    assert "rate" in body


@pytest.mark.asyncio
async def test_widget_data_member_workload(client: AsyncClient, workspace, headers):
    """Member workload widget data returns list of members."""
    create_r = await client.post(
        f"/api/v1/workspaces/{workspace.id}/dashboard/widgets",
        headers=headers,
        json={"widget_type": "member_workload"},
    )
    widget_id = create_r.json()["id"]

    data_r = await client.get(
        f"/api/v1/workspaces/{workspace.id}/dashboard/widgets/{widget_id}/data",
        headers=headers,
    )
    assert data_r.status_code == 200
    body = data_r.json()
    assert "members" in body
    assert isinstance(body["members"], list)


@pytest.mark.asyncio
async def test_reorder_widgets(client: AsyncClient, workspace, headers):
    """Admin can reorder widgets."""
    ids = []
    for wt in ["completion_rate", "overdue_count", "member_workload"]:
        r = await client.post(
            f"/api/v1/workspaces/{workspace.id}/dashboard/widgets",
            headers=headers,
            json={"widget_type": wt},
        )
        ids.append(r.json()["id"])

    reversed_ids = list(reversed(ids))
    reorder_r = await client.put(
        f"/api/v1/workspaces/{workspace.id}/dashboard/widgets/order",
        headers=headers,
        json={"widget_ids": reversed_ids},
    )
    assert reorder_r.status_code == 200
    result_ids = [w["id"] for w in reorder_r.json()]
    assert result_ids == reversed_ids
