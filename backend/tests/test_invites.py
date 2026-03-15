"""Tests for M-02: workspace email invite flow."""
import pytest
from unittest.mock import AsyncMock, patch

from tests.conftest import auth_headers, make_user


# ── helpers ───────────────────────────────────────────────────────────────────

async def _send_invite(client, workspace_id, email, headers, role="member"):
    return await client.post(
        f"/api/v1/workspaces/{workspace_id}/invites",
        json={"email": email, "role": role},
        headers=headers,
    )


# ── tests ─────────────────────────────────────────────────────────────────────


async def test_send_invite_returns_201(client, workspace, headers):
    """Owner can send an invite; returns 201 with invite data."""
    with patch("app.features.workspaces.router.send_email", new_callable=AsyncMock):
        r = await _send_invite(client, workspace.id, "newperson@example.com", headers)
    assert r.status_code == 201
    data = r.json()
    assert data["email"] == "newperson@example.com"
    assert data["role"] == "member"
    assert data["accepted_at"] is None
    assert "expires_at" in data


async def test_send_invite_non_admin_returns_403(client, db, workspace):
    """A plain member cannot send invites."""
    member = await make_user(db, "member@example.com")
    from app.models.workspace import WorkspaceMember, WorkspaceRole
    db.add(WorkspaceMember(workspace_id=workspace.id, user_id=member.id, role=WorkspaceRole.member))
    await db.commit()

    with patch("app.features.workspaces.router.send_email", new_callable=AsyncMock):
        r = await _send_invite(client, workspace.id, "other@example.com", auth_headers(member))
    assert r.status_code == 403


async def test_get_invite_by_token(client, workspace, headers):
    """GET /invites/{token} returns invite details."""
    with patch("app.features.workspaces.router.send_email", new_callable=AsyncMock):
        r = await _send_invite(client, workspace.id, "invite_get@example.com", headers)
    assert r.status_code == 201
    token = r.json()["id"]  # we'll fetch using token from the invite row

    # Re-query by token via the repo to get actual token value
    from app.features.workspaces.repository import WorkspaceRepository
    from tests.conftest import make_user
    # The invite token isn't exposed in the response; look it up in DB
    # We test the get-by-token endpoint by using the repository directly
    from sqlalchemy import select
    from app.models.workspace import WorkspaceInvite
    from tests.conftest import TEST_DATABASE_URL
    from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
    eng = create_async_engine(TEST_DATABASE_URL)
    factory = async_sessionmaker(eng, expire_on_commit=False)
    async with factory() as s:
        res = await s.execute(select(WorkspaceInvite).where(WorkspaceInvite.email == "invite_get@example.com"))
        inv = res.scalar_one()
        token = inv.token
    await eng.dispose()

    r2 = await client.get(f"/api/v1/workspaces/invites/{token}")
    assert r2.status_code == 200
    assert r2.json()["email"] == "invite_get@example.com"


async def test_accept_invite_adds_member(client, db, workspace, headers):
    """Accepting a valid invite adds the user as a workspace member."""
    invitee = await make_user(db, "invitee@example.com")
    await db.commit()

    with patch("app.features.workspaces.router.send_email", new_callable=AsyncMock):
        r = await _send_invite(client, workspace.id, "invitee@example.com", headers, role="member")
    assert r.status_code == 201

    # Grab the token
    from sqlalchemy import select
    from app.models.workspace import WorkspaceInvite, WorkspaceMember
    inv_res = await db.execute(select(WorkspaceInvite).where(WorkspaceInvite.email == "invitee@example.com"))
    inv = inv_res.scalar_one()

    r2 = await client.post(
        f"/api/v1/workspaces/invites/{inv.token}/accept",
        headers=auth_headers(invitee),
    )
    assert r2.status_code == 204

    # Verify WorkspaceMember was created
    mem_res = await db.execute(
        select(WorkspaceMember)
        .where(WorkspaceMember.workspace_id == workspace.id)
        .where(WorkspaceMember.user_id == invitee.id)
    )
    assert mem_res.scalar_one_or_none() is not None


async def test_accept_invite_twice_returns_409(client, db, workspace, headers):
    """Accepting the same invite twice returns 409."""
    invitee = await make_user(db, "double@example.com")
    await db.commit()

    with patch("app.features.workspaces.router.send_email", new_callable=AsyncMock):
        await _send_invite(client, workspace.id, "double@example.com", headers)

    from sqlalchemy import select
    from app.models.workspace import WorkspaceInvite
    inv_res = await db.execute(select(WorkspaceInvite).where(WorkspaceInvite.email == "double@example.com"))
    inv = inv_res.scalar_one()

    await client.post(f"/api/v1/workspaces/invites/{inv.token}/accept", headers=auth_headers(invitee))
    r = await client.post(f"/api/v1/workspaces/invites/{inv.token}/accept", headers=auth_headers(invitee))
    assert r.status_code == 409


async def test_accept_nonexistent_invite_returns_404(client, user, headers):
    """Accepting a bogus token returns 404."""
    r = await client.post("/api/v1/workspaces/invites/notarealtoken/accept", headers=headers)
    assert r.status_code == 404
