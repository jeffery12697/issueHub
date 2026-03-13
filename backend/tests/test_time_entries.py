"""
Tests for Phase 10: time tracking (TM-03), story points (TM-04), start_date (TM-01).
"""
import pytest
from httpx import AsyncClient

from tests.conftest import make_user, make_task, auth_headers


# ── helpers ───────────────────────────────────────────────────────────────────

async def log_time(client: AsyncClient, task_id, headers, duration_minutes=30, note=None):
    body = {"duration_minutes": duration_minutes}
    if note:
        body["note"] = note
    resp = await client.post(
        f"/api/v1/tasks/{task_id}/time-entries",
        json=body,
        headers=headers,
    )
    return resp


# ── TM-03: time tracking ──────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_log_time_returns_201(client, db, user, list_, headers):
    task = await make_task(client, list_, headers)
    resp = await log_time(client, task["id"], headers, duration_minutes=45, note="initial work")
    assert resp.status_code == 201
    data = resp.json()
    assert data["duration_minutes"] == 45
    assert data["note"] == "initial work"
    assert data["task_id"] == task["id"]
    assert data["user_id"] == str(user.id)
    assert "id" in data
    assert "logged_at" in data


@pytest.mark.asyncio
async def test_log_time_requires_positive_duration(client, db, user, list_, headers):
    task = await make_task(client, list_, headers)
    resp = await client.post(
        f"/api/v1/tasks/{task['id']}/time-entries",
        json={"duration_minutes": 0},
        headers=headers,
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_list_time_entries_returns_entries_and_total(client, db, user, list_, headers):
    task = await make_task(client, list_, headers)
    await log_time(client, task["id"], headers, duration_minutes=30)
    await log_time(client, task["id"], headers, duration_minutes=60)

    resp = await client.get(
        f"/api/v1/tasks/{task['id']}/time-entries",
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_minutes"] == 90
    assert len(data["entries"]) == 2


@pytest.mark.asyncio
async def test_list_time_entries_empty(client, db, user, list_, headers):
    task = await make_task(client, list_, headers)
    resp = await client.get(
        f"/api/v1/tasks/{task['id']}/time-entries",
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_minutes"] == 0
    assert data["entries"] == []


@pytest.mark.asyncio
async def test_delete_own_time_entry(client, db, user, list_, headers):
    task = await make_task(client, list_, headers)
    log_resp = await log_time(client, task["id"], headers, duration_minutes=20)
    entry_id = log_resp.json()["id"]

    del_resp = await client.delete(
        f"/api/v1/tasks/{task['id']}/time-entries/{entry_id}",
        headers=headers,
    )
    assert del_resp.status_code == 204

    # Verify it's gone
    list_resp = await client.get(
        f"/api/v1/tasks/{task['id']}/time-entries",
        headers=headers,
    )
    assert list_resp.json()["entries"] == []
    assert list_resp.json()["total_minutes"] == 0


@pytest.mark.asyncio
async def test_cannot_delete_another_users_time_entry(client, db, workspace, list_, headers):
    # user2 logs time
    user2 = await make_user(db, "user2@example.com")
    headers2 = auth_headers(user2)

    task = await make_task(client, list_, headers)
    log_resp = await log_time(client, task["id"], headers2, duration_minutes=15)
    entry_id = log_resp.json()["id"]

    # user1 tries to delete user2's entry
    del_resp = await client.delete(
        f"/api/v1/tasks/{task['id']}/time-entries/{entry_id}",
        headers=headers,
    )
    assert del_resp.status_code == 403


@pytest.mark.asyncio
async def test_delete_nonexistent_time_entry_returns_404(client, db, user, list_, headers):
    task = await make_task(client, list_, headers)
    import uuid
    fake_id = str(uuid.uuid4())
    resp = await client.delete(
        f"/api/v1/tasks/{task['id']}/time-entries/{fake_id}",
        headers=headers,
    )
    assert resp.status_code == 404


# ── TM-01: start_date and TM-04: story_points ─────────────────────────────────

@pytest.mark.asyncio
async def test_set_story_points_and_start_date_on_create(client, db, user, list_, headers):
    resp = await client.post(
        f"/api/v1/lists/{list_.id}/tasks",
        json={
            "title": "Task with points",
            "story_points": 5,
            "start_date": "2026-04-01T00:00:00Z",
        },
        headers=headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["story_points"] == 5
    assert data["start_date"] is not None


@pytest.mark.asyncio
async def test_patch_story_points_and_start_date(client, db, user, list_, headers):
    task = await make_task(client, list_, headers)

    patch_resp = await client.patch(
        f"/api/v1/tasks/{task['id']}",
        json={
            "story_points": 8,
            "start_date": "2026-05-15T09:00:00Z",
        },
        headers=headers,
    )
    assert patch_resp.status_code == 200
    data = patch_resp.json()
    assert data["story_points"] == 8
    assert data["start_date"] is not None


@pytest.mark.asyncio
async def test_story_points_and_start_date_default_none(client, db, user, list_, headers):
    task = await make_task(client, list_, headers, title="No points task")
    assert task["story_points"] is None
    assert task["start_date"] is None


@pytest.mark.asyncio
async def test_update_story_points_only(client, db, user, list_, headers):
    task = await make_task(client, list_, headers)

    resp = await client.patch(
        f"/api/v1/tasks/{task['id']}",
        json={"story_points": 13},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["story_points"] == 13
    assert resp.json()["start_date"] is None
