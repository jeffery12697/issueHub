"""
Webhook service: extract task keys from branch names, close or link tasks.
"""
import re
from uuid import UUID

from app.features.tasks.repository import TaskRepository
from app.features.lists.repository import ListRepository
from app.features.audit.repository import AuditRepository
from app.features.webhooks.schemas import WebhookResult

# Matches task keys like PROJ-0042, BACKEND-1, TSK-00007 (1–6 digits)
_TASK_KEY_RE = re.compile(r"\b([A-Z]+-\d{1,6})\b")


def extract_task_keys(text: str) -> list[str]:
    return list(dict.fromkeys(_TASK_KEY_RE.findall(text)))  # unique, order-preserved


class WebhookService:
    def __init__(
        self,
        task_repo: TaskRepository,
        list_repo: ListRepository,
        audit_repo: AuditRepository,
    ):
        self.task_repo = task_repo
        self.list_repo = list_repo
        self.audit_repo = audit_repo

    async def handle_pr_opened(
        self,
        platform: str,
        branch: str,
        repo: str,
        pr_number: int | None,
    ) -> WebhookResult:
        task_keys = extract_task_keys(branch)
        linked: list[str] = []
        skipped: list[str] = []
        errors: list[str] = []

        for key in task_keys:
            task = await self.task_repo.get_by_task_key(key)
            if not task:
                errors.append(key)
                continue
            await self.audit_repo.log(
                task.id,
                actor_id=None,
                action="git_branch_linked",
                changes={
                    "source": "git_webhook",
                    "platform": platform,
                    "event": "pr_opened",
                    "branch": branch,
                    "repo": repo,
                    "pr_number": pr_number,
                },
            )
            linked.append(key)

        return WebhookResult(
            event="pr_opened",
            platform=platform,
            branch=branch,
            task_keys_found=task_keys,
            closed=[],
            linked=linked,
            skipped=skipped,
            errors=errors,
        )

    async def handle_pr_merged(
        self,
        platform: str,
        branch: str,
        repo: str,
        merge_sha: str | None,
        pr_number: int | None,
    ) -> WebhookResult:
        task_keys = extract_task_keys(branch)
        closed: list[str] = []
        skipped: list[str] = []
        errors: list[str] = []

        for key in task_keys:
            task = await self.task_repo.get_by_task_key(key)
            if not task:
                errors.append(key)
                continue

            # Find first is_complete status for this task's list
            if not task.list_id:
                errors.append(key)
                continue

            statuses = await self.list_repo.list_statuses(task.list_id)
            complete_status = next((s for s in statuses if s.is_complete), None)
            if not complete_status:
                errors.append(key)
                continue

            # Idempotent: skip if already on a complete status
            if task.status_id == complete_status.id:
                skipped.append(key)
                continue

            task.status_id = complete_status.id
            await self.task_repo.session.flush()

            await self.audit_repo.log(
                task.id,
                actor_id=None,
                action="status_changed",
                changes={
                    "source": "git_webhook",
                    "platform": platform,
                    "event": "pr_merged",
                    "branch": branch,
                    "repo": repo,
                    "merge_sha": merge_sha,
                    "pr_number": pr_number,
                    "status": [None, complete_status.name],
                },
            )
            closed.append(key)

        return WebhookResult(
            event="pr_merged",
            platform=platform,
            branch=branch,
            task_keys_found=task_keys,
            closed=closed,
            linked=[],
            skipped=skipped,
            errors=errors,
        )
