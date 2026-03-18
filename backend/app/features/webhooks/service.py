"""
Webhook service: extract task keys from branch names, close or link tasks.
"""
import re
from uuid import UUID

from app.features.tasks.repository import TaskRepository
from app.features.lists.repository import ListRepository
from app.features.audit.repository import AuditRepository
from app.features.webhooks.repository import GitLinkRepository
from app.features.approvals.repository import ApprovalRepository
from app.features.webhooks.schemas import WebhookResult

# Matches task keys like PROJ-0042, BACKEND-1, TSK-00007 (1–6 digits), case-insensitive
# No word boundaries — underscore is a word char so \b fails on JEFF-0006_desc style branches
_TASK_KEY_RE = re.compile(r"([A-Z]+-\d{1,6})", re.IGNORECASE)


def extract_task_keys(text: str) -> list[str]:
    # Normalize to stored format: uppercase prefix + 5-digit zero-padded number (e.g. jeff-0008 → JEFF-00008)
    normalized = []
    for raw in _TASK_KEY_RE.findall(text):
        prefix, num = raw.rsplit("-", 1)
        normalized.append(f"{prefix.upper()}-{int(num):05d}")
    return list(dict.fromkeys(normalized))  # unique, order-preserved


class WebhookService:
    def __init__(
        self,
        task_repo: TaskRepository,
        list_repo: ListRepository,
        audit_repo: AuditRepository,
        git_link_repo: GitLinkRepository,
        approval_repo: ApprovalRepository,
    ):
        self.task_repo = task_repo
        self.list_repo = list_repo
        self.audit_repo = audit_repo
        self.git_link_repo = git_link_repo
        self.approval_repo = approval_repo

    async def handle_pr_opened(
        self,
        platform: str,
        branch: str,
        repo: str,
        pr_number: int | None,
        pr_title: str | None = None,
        pr_url: str | None = None,
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
            await self.git_link_repo.upsert_open(
                task_id=task.id,
                platform=platform,
                repo=repo,
                pr_number=pr_number,
                pr_title=pr_title,
                pr_url=pr_url,
                branch=branch,
            )
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
        pr_title: str | None = None,
        pr_url: str | None = None,
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

            await self.git_link_repo.mark_merged(
                task_id=task.id,
                platform=platform,
                repo=repo,
                pr_number=pr_number,
                pr_title=pr_title,
                pr_url=pr_url,
                branch=branch,
            )

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

    async def handle_pr_approved(
        self,
        platform: str,
        branch: str,
        approver_name: str | None,
        approver_email: str | None,
    ) -> WebhookResult:
        task_keys = extract_task_keys(branch)
        linked: list[str] = []
        errors: list[str] = []

        for key in task_keys:
            task = await self.task_repo.get_by_task_key(key)
            if not task:
                errors.append(key)
                continue

            # Try to match to an IssueHub user by email (GitLab sends email; GitHub does not)
            internal_user = None
            if approver_email:
                internal_user = await self.approval_repo.find_user_by_email(approver_email)

            if internal_user:
                already = await self.approval_repo.is_approved_by(task.id, internal_user.id)
                if not already:
                    await self.approval_repo.approve(task.id, internal_user.id)
                    await self.audit_repo.log(
                        task.id,
                        actor_id=internal_user.id,
                        action="task_approved",
                        changes={"source": platform, "via": "webhook"},
                    )
            else:
                display = approver_name or "Unknown"
                await self.approval_repo.approve_external(
                    task_id=task.id,
                    source=platform,
                    external_name=display,
                    external_email=approver_email,
                )
                await self.audit_repo.log(
                    task.id,
                    actor_id=None,
                    action="task_approved",
                    changes={"source": platform, "via": "webhook", "approver": display},
                )

            linked.append(key)

        return WebhookResult(
            event="pr_approved",
            platform=platform,
            branch=branch,
            task_keys_found=task_keys,
            closed=[],
            linked=linked,
            skipped=[],
            errors=errors,
        )
