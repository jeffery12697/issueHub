from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.task_git_link import TaskGitLink


class GitLinkRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def upsert_open(
        self,
        task_id: UUID,
        platform: str,
        repo: str,
        pr_number: int | None,
        pr_title: str | None,
        pr_url: str | None,
        branch: str,
    ) -> None:
        now = datetime.now(timezone.utc)
        stmt = (
            pg_insert(TaskGitLink)
            .values(
                id=uuid4(),
                task_id=task_id,
                platform=platform,
                repo=repo,
                pr_number=pr_number,
                pr_title=pr_title,
                pr_url=pr_url,
                branch=branch,
                status="open",
                linked_at=now,
                merged_at=None,
            )
            .on_conflict_do_update(
                constraint="uq_task_git_link",
                set_={
                    "pr_title": pr_title,
                    "pr_url": pr_url,
                    "branch": branch,
                    "status": "open",
                    "merged_at": None,
                },
            )
        )
        await self.session.execute(stmt)

    async def mark_merged(
        self,
        task_id: UUID,
        platform: str,
        repo: str,
        pr_number: int | None,
        pr_title: str | None,
        pr_url: str | None,
        branch: str,
    ) -> None:
        now = datetime.now(timezone.utc)
        stmt = (
            pg_insert(TaskGitLink)
            .values(
                id=uuid4(),
                task_id=task_id,
                platform=platform,
                repo=repo,
                pr_number=pr_number,
                pr_title=pr_title,
                pr_url=pr_url,
                branch=branch,
                status="merged",
                linked_at=now,
                merged_at=now,
            )
            .on_conflict_do_update(
                constraint="uq_task_git_link",
                set_={
                    "pr_title": pr_title,
                    "pr_url": pr_url,
                    "status": "merged",
                    "merged_at": now,
                },
            )
        )
        await self.session.execute(stmt)

    async def list_for_task(self, task_id: UUID) -> list[TaskGitLink]:
        result = await self.session.execute(
            select(TaskGitLink)
            .where(TaskGitLink.task_id == task_id)
            .order_by(TaskGitLink.linked_at.desc())
        )
        return list(result.scalars().all())
