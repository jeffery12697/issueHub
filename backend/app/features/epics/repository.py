from uuid import UUID

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.epic import Epic
from app.models.task import Task
from app.features.epics.schemas import CreateEpicDTO, UpdateEpicDTO


class EpicRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, dto: CreateEpicDTO) -> Epic:
        order_index = await self._next_order_index(dto.project_id)
        epic = Epic(
            project_id=dto.project_id,
            workspace_id=dto.workspace_id,
            name=dto.name,
            description=dto.description,
            color=dto.color,
            status=dto.status,
            start_date=dto.start_date,
            due_date=dto.due_date,
            order_index=order_index,
            created_by=dto.created_by,
        )
        self.session.add(epic)
        await self.session.flush()
        return epic

    async def get_by_id(self, epic_id: UUID) -> Epic | None:
        result = await self.session.execute(
            select(Epic)
            .where(Epic.id == epic_id)
            .where(Epic.deleted_at.is_(None))
        )
        return result.scalar_one_or_none()

    async def list_for_project(self, project_id: UUID) -> list[Epic]:
        result = await self.session.execute(
            select(Epic)
            .where(Epic.project_id == project_id)
            .where(Epic.deleted_at.is_(None))
            .order_by(Epic.order_index)
        )
        return list(result.scalars().all())

    async def update(self, epic: Epic, dto: UpdateEpicDTO) -> Epic:
        if dto.name is not None:
            epic.name = dto.name
        if dto.description is not None:
            epic.description = dto.description
        if dto.color is not None:
            epic.color = dto.color
        if dto.status is not None:
            epic.status = dto.status
        if dto.start_date is not None:
            epic.start_date = dto.start_date
        if dto.due_date is not None:
            epic.due_date = dto.due_date
        await self.session.flush()
        return epic

    async def soft_delete(self, epic: Epic) -> None:
        epic.soft_delete()
        # Unlink all tasks from this epic (ON DELETE SET NULL handles DB-level,
        # but we do it explicitly here so in-session objects are also cleared)
        await self.session.execute(
            update(Task)
            .where(Task.epic_id == epic.id)
            .where(Task.deleted_at.is_(None))
            .values(epic_id=None)
        )
        await self.session.flush()

    async def task_counts(self, epic_id: UUID) -> tuple[int, int]:
        """Return (total_task_count, done_task_count) for an epic."""
        from app.models.list_status import ListStatus

        total_result = await self.session.execute(
            select(func.count())
            .select_from(Task)
            .where(Task.epic_id == epic_id)
            .where(Task.deleted_at.is_(None))
        )
        total = total_result.scalar_one()

        done_result = await self.session.execute(
            select(func.count())
            .select_from(Task)
            .join(ListStatus, Task.status_id == ListStatus.id)
            .where(Task.epic_id == epic_id)
            .where(Task.deleted_at.is_(None))
            .where(ListStatus.is_complete == True)  # noqa: E712
        )
        done = done_result.scalar_one()

        return total, done

    async def list_tasks(self, epic_id: UUID) -> list[Task]:
        result = await self.session.execute(
            select(Task)
            .where(Task.epic_id == epic_id)
            .where(Task.deleted_at.is_(None))
            .where(Task.parent_task_id.is_(None))
            .order_by(Task.list_id, Task.order_index)
        )
        return list(result.scalars().all())

    async def _next_order_index(self, project_id: UUID) -> float:
        result = await self.session.execute(
            select(func.max(Epic.order_index))
            .where(Epic.project_id == project_id)
            .where(Epic.deleted_at.is_(None))
        )
        return (result.scalar_one_or_none() or 0.0) + 100.0
