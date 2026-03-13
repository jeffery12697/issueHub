from uuid import UUID

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.task_dependency import TaskDependency
from app.models.task import Task


class DependencyRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def add(self, task_id: UUID, depends_on_id: UUID) -> TaskDependency:
        dep = TaskDependency(task_id=task_id, depends_on_id=depends_on_id)
        self.session.add(dep)
        await self.session.flush()
        return dep

    async def remove(self, task_id: UUID, depends_on_id: UUID) -> None:
        await self.session.execute(
            delete(TaskDependency)
            .where(TaskDependency.task_id == task_id)
            .where(TaskDependency.depends_on_id == depends_on_id)
        )

    async def exists(self, task_id: UUID, depends_on_id: UUID) -> bool:
        result = await self.session.execute(
            select(TaskDependency)
            .where(TaskDependency.task_id == task_id)
            .where(TaskDependency.depends_on_id == depends_on_id)
        )
        return result.scalar_one_or_none() is not None

    async def get_blocked_by(self, task_id: UUID) -> list[Task]:
        """Tasks that task_id is blocked by (depends on)."""
        result = await self.session.execute(
            select(Task)
            .join(TaskDependency, TaskDependency.depends_on_id == Task.id)
            .where(TaskDependency.task_id == task_id)
            .where(Task.deleted_at.is_(None))
        )
        return list(result.scalars().all())

    async def get_blocking(self, task_id: UUID) -> list[Task]:
        """Tasks that are blocked by task_id."""
        result = await self.session.execute(
            select(Task)
            .join(TaskDependency, TaskDependency.task_id == Task.id)
            .where(TaskDependency.depends_on_id == task_id)
            .where(Task.deleted_at.is_(None))
        )
        return list(result.scalars().all())

    async def get_dependency_flags(self, task_ids: list[UUID]) -> dict[UUID, dict]:
        """Return {task_id: {is_blocked, is_blocking}} for a batch of task IDs."""
        if not task_ids:
            return {}
        from sqlalchemy import distinct
        blocked_result = await self.session.execute(
            select(distinct(TaskDependency.task_id))
            .where(TaskDependency.task_id.in_(task_ids))
        )
        blocked_ids = set(blocked_result.scalars().all())

        blocking_result = await self.session.execute(
            select(distinct(TaskDependency.depends_on_id))
            .where(TaskDependency.depends_on_id.in_(task_ids))
        )
        blocking_ids = set(blocking_result.scalars().all())

        return {
            tid: {"is_blocked": tid in blocked_ids, "is_blocking": tid in blocking_ids}
            for tid in task_ids
        }
