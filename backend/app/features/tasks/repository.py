from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.task import Task, Priority
from app.features.tasks.schemas import CreateTaskDTO, UpdateTaskDTO


class TaskRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, dto: CreateTaskDTO, order_index: float) -> Task:
        task = Task(
            title=dto.title,
            description=dto.description,
            priority=dto.priority,
            list_id=dto.list_id,
            workspace_id=dto.workspace_id,
            project_id=dto.project_id,
            reporter_id=dto.reporter_id,
            reviewer_id=dto.reviewer_id,
            assignee_ids=list(dto.assignee_ids),
            due_date=dto.due_date,
            order_index=order_index,
            depth=0,
            path="placeholder",  # updated after flush once id is known
        )
        self.session.add(task)
        await self.session.flush()

        # Set ltree path to task's own id (root task)
        task.path = str(task.id).replace("-", "_")
        await self.session.flush()
        return task

    async def get_by_id(self, task_id: UUID) -> Task | None:
        result = await self.session.execute(
            select(Task)
            .where(Task.id == task_id)
            .where(Task.deleted_at.is_(None))
        )
        return result.scalar_one_or_none()

    async def list_for_list(
        self,
        list_id: UUID,
        status_id: UUID | None = None,
        priority: Priority | None = None,
        assignee_id: UUID | None = None,
    ) -> list[Task]:
        q = (
            select(Task)
            .where(Task.list_id == list_id)
            .where(Task.deleted_at.is_(None))
            .where(Task.parent_task_id.is_(None))  # root tasks only
        )
        if status_id:
            q = q.where(Task.status_id == status_id)
        if priority:
            q = q.where(Task.priority == priority)
        if assignee_id:
            q = q.where(Task.assignee_ids.any(assignee_id))

        q = q.order_by(Task.order_index)
        result = await self.session.execute(q)
        return list(result.scalars().all())

    async def get_max_order_index(self, list_id: UUID) -> float:
        from sqlalchemy import func
        result = await self.session.execute(
            select(func.max(Task.order_index))
            .where(Task.list_id == list_id)
            .where(Task.deleted_at.is_(None))
        )
        return result.scalar_one_or_none() or 0.0

    async def update(self, task: Task, dto: UpdateTaskDTO) -> Task:
        if dto.title is not None:
            task.title = dto.title
        if dto.description is not None:
            task.description = dto.description
        if dto.priority is not None:
            task.priority = dto.priority
        if dto.status_id is not None:
            task.status_id = dto.status_id
        if dto.assignee_ids is not None:
            task.assignee_ids = list(dto.assignee_ids)
        if dto.reviewer_id is not None:
            task.reviewer_id = dto.reviewer_id
        if dto.due_date is not None:
            task.due_date = dto.due_date
        await self.session.flush()
        return task

    async def soft_delete(self, task: Task) -> None:
        task.soft_delete()
        await self.session.flush()
