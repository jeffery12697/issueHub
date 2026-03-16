# Git Webhook Integration (AU-04)

Automatically close linked IssueHub tasks when a Pull Request (GitHub) or Merge Request (GitLab) is merged.

---

## Overview

A single endpoint `POST /webhooks/git` handles MR/PR events from both GitHub and GitLab.

Tasks are identified by their **task key** (e.g. `PROJ-0042`) extracted from the branch name.
When the MR/PR for that branch is merged, the linked task is automatically set to Done.

### Flow

```
1. Developer creates branch:  feature/PROJ-0042-add-login
2. Developer opens PR/MR      → task is linked (status unchanged)
3. PR/MR is merged            → task status set to Done
```

---

## Task Key Format

```
<PROJECT_PREFIX>-<NNNN>
```

Examples: `PROJ-0001`, `BACKEND-0042`, `TSK-0007`

Regex used to extract a task key from a branch name:
```
[A-Z]+-\d{1,6}
```

Common branch naming conventions that are automatically recognized:
```
feature/PROJ-0042-add-login
fix/PROJ-0042
PROJ-0042-refactor-auth
chore/PROJ-0042/update-deps
```

---

## Endpoint

```
POST /webhooks/git
```

No authentication header required — security is handled via signature/token verification (see below).

---

## Platform Detection & Verification

| Platform | Header | Verification method |
|----------|--------|---------------------|
| GitHub | `X-Hub-Signature-256: sha256=<hmac>` | HMAC-SHA256 of raw request body using `WEBHOOK_SECRET` |
| GitLab | `X-Gitlab-Token: <token>` | Direct constant-time comparison with `WEBHOOK_SECRET` |

If verification fails → `403 Forbidden`.
If neither header is present → `400 Bad Request`.

---

## Supported Events

### GitHub — Pull Request event

Configure the webhook to send **Pull request** events.

Relevant payload fields:
```json
{
  "action": "closed",
  "pull_request": {
    "merged": true,
    "head": { "ref": "feature/PROJ-0042-add-login" },
    "merged_by": { "login": "jeffery" },
    "merge_commit_sha": "abc1234"
  },
  "repository": { "full_name": "org/repo" }
}
```

Trigger condition: `action == "closed" AND pull_request.merged == true`

Ignored events: `action == "opened"`, `action == "closed"` with `merged == false` (abandoned PR).

### GitLab — Merge Request Hook

Configure the webhook to send **Merge request events**.

Relevant payload fields:
```json
{
  "object_kind": "merge_request",
  "object_attributes": {
    "action": "merge",
    "source_branch": "feature/PROJ-0042-add-login",
    "merge_commit_sha": "abc1234",
    "last_commit": { "author": { "name": "Jeffery" } }
  },
  "project": { "path_with_namespace": "org/repo" }
}
```

Trigger condition: `object_kind == "merge_request" AND object_attributes.action == "merge"`

---

## Task Actions on Merge

For each task key found in the merged branch name:

1. Look up task by `task_key` (indexed column).
2. Find task's list → find first status where `is_complete = true`.
3. Update `task.status_id` to that status.
4. Write audit log entry:
   - `action = status_changed`
   - `metadata = { "source": "git_merge", "branch": "...", "repo": "...", "merge_sha": "...", "platform": "github"|"gitlab" }`
5. Trigger existing automation rules that fire on status change.

If the task is already complete → skip (idempotent).
If the task key does not exist → log warning, continue.

---

## Task Actions on PR/MR Open (optional link)

When a PR/MR is **opened** (not yet merged), link the branch to the task for visibility in the task detail sidebar.

GitHub condition: `action == "opened"`
GitLab condition: `object_attributes.action == "open"`

Action: write audit log entry with `action = git_branch_linked`.
This is informational only — no status change.

Deduplication: if the branch is already linked, skip.

---

## Response

```json
{
  "event": "pr_merged",
  "branch": "feature/PROJ-0042-add-login",
  "task_keys_found": ["PROJ-0042"],
  "closed": ["PROJ-0042"],
  "skipped": [],
  "errors": []
}
```

- `closed` — task keys successfully set to Done
- `skipped` — task keys already complete
- `errors` — task keys not found or failed

Always returns `200 OK` (even for partial failures) so the platform doesn't retry.

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `WEBHOOK_SECRET` | Shared secret for both GitHub HMAC verification and GitLab token comparison |

Add to `.env` and `.env.example`:
```
WEBHOOK_SECRET=your_secret_here
```

---

## File Structure

```
backend/app/features/webhooks/
  __init__.py
  router.py       # POST /webhooks/git — verify + dispatch
  service.py      # detect event type, extract branch/task key, close tasks, write audit log
  schemas.py      # GitHub/GitLab payload schemas (Pydantic)
backend/tests/
  test_webhooks.py
```

Register router in `backend/app/main.py`:
```python
from app.features.webhooks.router import router as webhooks_router
app.include_router(webhooks_router, prefix="/webhooks", tags=["webhooks"])
```

---

## Tests (`backend/tests/test_webhooks.py`)

| Test | Description |
|------|-------------|
| `test_github_pr_merged_closes_task` | GitHub PR merged, branch has task key → task closed |
| `test_gitlab_mr_merged_closes_task` | GitLab MR merged, branch has task key → task closed |
| `test_github_pr_opened_links_task` | GitHub PR opened → task linked, no status change |
| `test_gitlab_mr_opened_links_task` | GitLab MR opened → task linked, no status change |
| `test_github_pr_closed_not_merged` | GitHub PR abandoned (merged=false) → no action |
| `test_branch_link_dedup` | Same branch PR opened twice → linked only once |
| `test_github_invalid_signature` | Wrong HMAC → 403 |
| `test_gitlab_invalid_token` | Wrong token → 403 |
| `test_missing_headers` | No platform headers → 400 |
| `test_already_complete_task_skipped` | Task already Done → skipped, 200 |
| `test_unknown_task_key_in_branch` | Branch has no matching task key → empty result, 200 |
| `test_branch_no_task_key` | Branch name has no task key pattern → nothing matched, 200 |
| `test_multiple_task_keys_in_branch` | Branch `PROJ-0042-and-PROJ-0043` → both closed |

---

## GitHub Setup

1. Go to repo → **Settings → Webhooks → Add webhook**
2. Payload URL: `https://yourdomain.com/webhooks/git`
3. Content type: `application/json`
4. Secret: value of `WEBHOOK_SECRET`
5. Events: select **Let me select individual events** → check **Pull requests**

## GitLab Setup

1. Go to project → **Settings → Webhooks**
2. URL: `https://yourdomain.com/webhooks/git`
3. Secret token: value of `WEBHOOK_SECRET`
4. Trigger: check **Merge request events**

> **Local development**: Use [ngrok](https://ngrok.com/) or [smee.io](https://smee.io/) to expose your local server.

---

## Security Notes

- Always use `hmac.compare_digest` (constant-time) for both HMAC and token comparisons to prevent timing attacks.
- Validate `Content-Type: application/json` before parsing.
- Log verification failures with IP for audit purposes — do not expose the secret in logs.
- The task key regex `[A-Z]+-\d{1,6}` is intentionally strict to avoid false positives in branch names.
