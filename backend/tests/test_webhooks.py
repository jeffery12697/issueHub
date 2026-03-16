"""
Tests for POST /webhooks/git (GitHub PR and GitLab MR events).

The WEBHOOK_SECRET is set to a known value via monkeypatch so we can
compute valid HMAC signatures in tests.
"""
import hashlib
import hmac
import json

import pytest

from tests.conftest import make_task, auth_headers
from app.core.config import settings
from app.models.list_status import ListStatus

TEST_SECRET = "test-webhook-secret"


# ── helpers ───────────────────────────────────────────────────────────────────

def _github_headers(body: bytes, event: str = "pull_request") -> dict:
    sig = "sha256=" + hmac.new(TEST_SECRET.encode(), body, hashlib.sha256).hexdigest()
    return {
        "Content-Type": "application/json",
        "X-Hub-Signature-256": sig,
        "X-Github-Event": event,
    }


def _gitlab_headers() -> dict:
    return {
        "Content-Type": "application/json",
        "X-Gitlab-Token": TEST_SECRET,
        "X-Gitlab-Event": "Merge Request Hook",
    }


def _github_pr_payload(branch: str, action: str = "opened", merged: bool = False) -> dict:
    return {
        "action": action,
        "pull_request": {
            "merged": merged,
            "head": {"ref": branch},
            "merge_commit_sha": "abc1234" if merged else None,
            "number": 99,
        },
        "repository": {"full_name": "org/repo"},
    }


def _gitlab_mr_payload(branch: str, action: str = "open") -> dict:
    return {
        "object_kind": "merge_request",
        "object_attributes": {
            "action": action,
            "source_branch": branch,
            "merge_commit_sha": "abc1234" if action == "merge" else None,
            "iid": 42,
        },
        "project": {"path_with_namespace": "org/repo"},
    }


async def _make_complete_status(db, list_) -> ListStatus:
    status = ListStatus(
        list_id=list_.id,
        name="Done",
        color="#00ff00",
        category="done",
        order_index=100.0,
        is_complete=True,
    )
    db.add(status)
    await db.flush()
    return status


# ── fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def patch_webhook_secret(monkeypatch):
    monkeypatch.setattr(settings, "webhook_secret", TEST_SECRET)


# ── signature verification ────────────────────────────────────────────────────

async def test_github_invalid_signature(client):
    payload = _github_pr_payload("feature/PROJ-0001")
    body = json.dumps(payload).encode()
    resp = await client.post(
        "/webhooks/git",
        content=body,
        headers={
            "Content-Type": "application/json",
            "X-Hub-Signature-256": "sha256=badsignature",
            "X-Github-Event": "pull_request",
        },
    )
    assert resp.status_code == 403


async def test_gitlab_invalid_token(client):
    payload = _gitlab_mr_payload("feature/PROJ-0001")
    resp = await client.post(
        "/webhooks/git",
        json=payload,
        headers={**_gitlab_headers(), "X-Gitlab-Token": "wrongtoken"},
    )
    assert resp.status_code == 403


async def test_missing_signature_headers(client):
    resp = await client.post(
        "/webhooks/git",
        json=_github_pr_payload("feature/PROJ-0001"),
        headers={"Content-Type": "application/json"},
    )
    assert resp.status_code == 400


# ── GitHub PR opened → task linked ───────────────────────────────────────────

async def test_github_pr_opened_links_task(client, db, list_, headers):
    task = await make_task(client, list_, headers, title="Login bug")
    task_key = task["task_key"]
    branch = f"feature/{task_key}-fix-login"

    payload = _github_pr_payload(branch, action="opened")
    body = json.dumps(payload).encode()
    resp = await client.post("/webhooks/git", content=body, headers=_github_headers(body))

    assert resp.status_code == 200
    data = resp.json()
    assert task_key in data["linked"]
    assert data["closed"] == []


# ── GitLab MR opened → task linked ───────────────────────────────────────────

async def test_gitlab_mr_opened_links_task(client, db, list_, headers):
    task = await make_task(client, list_, headers, title="Fix auth")
    task_key = task["task_key"]
    branch = f"fix/{task_key}"

    payload = _gitlab_mr_payload(branch, action="open")
    body = json.dumps(payload).encode()
    resp = await client.post("/webhooks/git", content=body, headers=_gitlab_headers())

    assert resp.status_code == 200
    data = resp.json()
    assert task_key in data["linked"]
    assert data["closed"] == []


# ── GitHub PR merged → task closed ───────────────────────────────────────────

async def test_github_pr_merged_closes_task(client, db, list_, headers):
    await _make_complete_status(db, list_)
    task = await make_task(client, list_, headers)
    task_key = task["task_key"]
    branch = f"feature/{task_key}-add-login"

    payload = _github_pr_payload(branch, action="closed", merged=True)
    body = json.dumps(payload).encode()
    resp = await client.post("/webhooks/git", content=body, headers=_github_headers(body))

    assert resp.status_code == 200
    data = resp.json()
    assert task_key in data["closed"]
    assert data["linked"] == []


# ── GitLab MR merged → task closed ───────────────────────────────────────────

async def test_gitlab_mr_merged_closes_task(client, db, list_, headers):
    await _make_complete_status(db, list_)
    task = await make_task(client, list_, headers)
    task_key = task["task_key"]
    branch = f"feature/{task_key}-some-feature"

    payload = _gitlab_mr_payload(branch, action="merge")
    body = json.dumps(payload).encode()
    resp = await client.post("/webhooks/git", content=body, headers=_gitlab_headers())

    assert resp.status_code == 200
    data = resp.json()
    assert task_key in data["closed"]


# ── GitHub PR closed but NOT merged → no action ──────────────────────────────

async def test_github_pr_closed_not_merged(client, db, list_, headers):
    task = await make_task(client, list_, headers)
    task_key = task["task_key"]
    branch = f"feature/{task_key}-abandoned"

    payload = _github_pr_payload(branch, action="closed", merged=False)
    body = json.dumps(payload).encode()
    resp = await client.post("/webhooks/git", content=body, headers=_github_headers(body))

    assert resp.status_code == 200
    data = resp.json()
    assert data["closed"] == []
    assert data["linked"] == []


# ── Already complete → skipped ────────────────────────────────────────────────

async def test_already_complete_task_skipped(client, db, list_, headers):
    complete_status = await _make_complete_status(db, list_)
    task = await make_task(client, list_, headers)
    task_key = task["task_key"]

    # Merge once to close it
    branch = f"feature/{task_key}-first"
    payload = _github_pr_payload(branch, action="closed", merged=True)
    body = json.dumps(payload).encode()
    await client.post("/webhooks/git", content=body, headers=_github_headers(body))

    # Merge again (same task key in a different branch)
    branch2 = f"fix/{task_key}-second"
    payload2 = _github_pr_payload(branch2, action="closed", merged=True)
    body2 = json.dumps(payload2).encode()
    resp = await client.post("/webhooks/git", content=body2, headers=_github_headers(body2))

    assert resp.status_code == 200
    data = resp.json()
    assert task_key in data["skipped"]
    assert task_key not in data["closed"]


# ── Unknown task key → errors list ───────────────────────────────────────────

async def test_unknown_task_key_in_branch(client):
    branch = "feature/FAKE-9999-nonexistent"
    payload = _github_pr_payload(branch, action="closed", merged=True)
    body = json.dumps(payload).encode()
    resp = await client.post("/webhooks/git", content=body, headers=_github_headers(body))

    assert resp.status_code == 200
    data = resp.json()
    assert "FAKE-9999" in data["errors"]
    assert data["closed"] == []


# ── Branch with no task key → nothing matched ────────────────────────────────

async def test_branch_no_task_key(client):
    branch = "main"
    payload = _github_pr_payload(branch, action="closed", merged=True)
    body = json.dumps(payload).encode()
    resp = await client.post("/webhooks/git", content=body, headers=_github_headers(body))

    assert resp.status_code == 200
    data = resp.json()
    assert data["task_keys_found"] == []
    assert data["closed"] == []


# ── Multiple task keys in one branch ─────────────────────────────────────────

async def test_multiple_task_keys_in_branch(client, db, list_, headers):
    await _make_complete_status(db, list_)
    task1 = await make_task(client, list_, headers, title="Task 1")
    task2 = await make_task(client, list_, headers, title="Task 2")
    key1, key2 = task1["task_key"], task2["task_key"]

    branch = f"feature/{key1}-and-{key2}-combined"
    payload = _github_pr_payload(branch, action="closed", merged=True)
    body = json.dumps(payload).encode()
    resp = await client.post("/webhooks/git", content=body, headers=_github_headers(body))

    assert resp.status_code == 200
    data = resp.json()
    assert key1 in data["closed"]
    assert key2 in data["closed"]
