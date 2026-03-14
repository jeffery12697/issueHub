"""Tests for GET /projects/{project_id}/tasks — cross-list task view."""
import pytest
from httpx import AsyncClient
from tests.conftest import make_user, make_workspace, make_project, make_list, auth_headers


async def make_task(client, list_, headers, title="Task", priority="none"):
    r = await client.post(f"/api/v1/lists/{list_.id}/tasks", json={"title": title, "priority": priority}, headers=headers)
    assert r.status_code == 201
    return r.json()


async def test_list_project_tasks_returns_all_lists(client, db, user, workspace, project, list_, headers):
    """Tasks from multiple lists in the project are all returned."""
    list2 = await make_list(db, project, name="List 2")
    await db.commit()

    await make_task(client, list_, headers, "Task in L1")
    await make_task(client, list2, headers, "Task in L2")

    r = await client.get(f"/api/v1/projects/{project.id}/tasks", headers=headers)
    assert r.status_code == 200
    titles = [t["title"] for t in r.json()]
    assert "Task in L1" in titles
    assert "Task in L2" in titles


async def test_list_project_tasks_filter_by_list(client, db, user, workspace, project, list_, headers):
    """list_id filter restricts results to that list only."""
    list2 = await make_list(db, project, name="List 2")
    await db.commit()

    await make_task(client, list_, headers, "L1 task")
    await make_task(client, list2, headers, "L2 task")

    r = await client.get(f"/api/v1/projects/{project.id}/tasks?list_id={list_.id}", headers=headers)
    assert r.status_code == 200
    titles = [t["title"] for t in r.json()]
    assert "L1 task" in titles
    assert "L2 task" not in titles


async def test_list_project_tasks_filter_by_priority(client, db, user, workspace, project, list_, headers):
    """priority filter returns only matching tasks."""
    await make_task(client, list_, headers, "Urgent task", priority="urgent")
    await make_task(client, list_, headers, "Normal task", priority="none")

    r = await client.get(f"/api/v1/projects/{project.id}/tasks?priority=urgent", headers=headers)
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 1
    assert data[0]["title"] == "Urgent task"


async def test_list_project_tasks_requires_auth(client, db, user, workspace, project, list_):
    r = await client.get(f"/api/v1/projects/{project.id}/tasks")
    assert r.status_code == 403


async def test_list_project_tasks_non_member_forbidden(client, db, user, workspace, project, list_, headers):
    other = await make_user(db, "other@example.com")
    await db.commit()
    r = await client.get(f"/api/v1/projects/{project.id}/tasks", headers=auth_headers(other))
    assert r.status_code == 403


async def test_list_project_tasks_pagination_header(client, db, user, workspace, project, list_, headers):
    """X-Total-Count header is set."""
    await make_task(client, list_, headers, "T1")
    await make_task(client, list_, headers, "T2")

    r = await client.get(f"/api/v1/projects/{project.id}/tasks?page=1&page_size=1", headers=headers)
    assert r.status_code == 200
    assert r.headers["x-total-count"] == "2"
    assert len(r.json()) == 1


async def test_list_project_tasks_excludes_other_projects(client, db, user, workspace, project, list_, headers):
    """Tasks from other projects in the same workspace are not returned."""
    other_project = await make_project(db, workspace, name="Other Project")
    other_list = await make_list(db, other_project)
    await db.commit()

    await make_task(client, list_, headers, "My task")
    await make_task(client, other_list, headers, "Other task")

    r = await client.get(f"/api/v1/projects/{project.id}/tasks", headers=headers)
    assert r.status_code == 200
    titles = [t["title"] for t in r.json()]
    assert "My task" in titles
    assert "Other task" not in titles
