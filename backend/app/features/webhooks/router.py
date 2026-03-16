"""
POST /webhooks/git — receives GitHub PR and GitLab MR events.
Verification:
  - GitHub: HMAC-SHA256 signature in X-Hub-Signature-256 header
  - GitLab: plain token in X-Gitlab-Token header
"""
import hashlib
import hmac
import json

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_session
from app.features.audit.repository import AuditRepository
from app.features.lists.repository import ListRepository
from app.features.tasks.repository import TaskRepository
from app.features.webhooks.schemas import GitHubPRPayload, GitLabMRPayload, WebhookResult
from app.features.webhooks.service import WebhookService

router = APIRouter(tags=["webhooks"])


def _verify_github(raw_body: bytes, signature_header: str) -> None:
    if not settings.webhook_secret:
        raise HTTPException(status_code=500, detail="WEBHOOK_SECRET not configured")
    expected = "sha256=" + hmac.new(
        settings.webhook_secret.encode(),
        raw_body,
        digestmod=hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(expected, signature_header):
        raise HTTPException(status_code=403, detail="Invalid GitHub signature")


def _verify_gitlab(token_header: str) -> None:
    if not settings.webhook_secret:
        raise HTTPException(status_code=500, detail="WEBHOOK_SECRET not configured")
    if not hmac.compare_digest(settings.webhook_secret, token_header):
        raise HTTPException(status_code=403, detail="Invalid GitLab token")


@router.post("/webhooks/git", response_model=WebhookResult)
async def git_webhook(
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> WebhookResult:
    raw_body = await request.body()

    github_sig = request.headers.get("X-Hub-Signature-256")
    gitlab_token = request.headers.get("X-Gitlab-Token")
    github_event = request.headers.get("X-Github-Event", "")
    gitlab_event = request.headers.get("X-Gitlab-Event", "")

    if github_sig:
        _verify_github(raw_body, github_sig)
        platform = "github"
    elif gitlab_token:
        _verify_gitlab(gitlab_token)
        platform = "gitlab"
    else:
        raise HTTPException(status_code=400, detail="Missing webhook signature headers")

    try:
        payload = json.loads(raw_body)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    svc = WebhookService(
        task_repo=TaskRepository(session),
        list_repo=ListRepository(session),
        audit_repo=AuditRepository(session),
    )

    result: WebhookResult

    if platform == "github" and github_event == "pull_request":
        pr = GitHubPRPayload.model_validate(payload)
        branch = pr.pull_request.head.ref
        repo = pr.repository.full_name
        if pr.action == "opened":
            result = await svc.handle_pr_opened(
                platform=platform,
                branch=branch,
                repo=repo,
                pr_number=pr.pull_request.number,
            )
        elif pr.action == "closed" and pr.pull_request.merged:
            result = await svc.handle_pr_merged(
                platform=platform,
                branch=branch,
                repo=repo,
                merge_sha=pr.pull_request.merge_commit_sha,
                pr_number=pr.pull_request.number,
            )
        else:
            # Other PR actions (synchronize, labeled, etc.) — no-op
            result = WebhookResult(
                event=f"pr_{pr.action}",
                platform=platform,
                branch=branch,
                task_keys_found=[],
                closed=[],
                linked=[],
                skipped=[],
                errors=[],
            )

    elif platform == "gitlab" and gitlab_event == "Merge Request Hook":
        mr = GitLabMRPayload.model_validate(payload)
        branch = mr.object_attributes.source_branch
        repo = mr.project.path_with_namespace
        if mr.object_attributes.action == "open":
            result = await svc.handle_pr_opened(
                platform=platform,
                branch=branch,
                repo=repo,
                pr_number=mr.object_attributes.iid,
            )
        elif mr.object_attributes.action == "merge":
            result = await svc.handle_pr_merged(
                platform=platform,
                branch=branch,
                repo=repo,
                merge_sha=mr.object_attributes.merge_commit_sha,
                pr_number=mr.object_attributes.iid,
            )
        else:
            result = WebhookResult(
                event=f"mr_{mr.object_attributes.action}",
                platform=platform,
                branch=branch,
                task_keys_found=[],
                closed=[],
                linked=[],
                skipped=[],
                errors=[],
            )

    else:
        # Unknown event type — acknowledge and ignore
        result = WebhookResult(
            event=github_event or gitlab_event or "unknown",
            platform=platform,
            branch="",
            task_keys_found=[],
            closed=[],
            linked=[],
            skipped=[],
            errors=[],
        )

    await session.commit()
    return result
