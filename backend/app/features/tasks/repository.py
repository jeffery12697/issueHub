from uuid import UUID

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy_utils.types.ltree import Ltree

from app.models.task import Task, Priority
from app.features.tasks.schemas import CreateTaskDTO, UpdateTaskDTO


class TaskRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, dto: CreateTaskDTO, order_index: float) -> Task:
        depth = 0
        parent_path = None

        if dto.parent_task_id:
            parent = await self.get_by_id(dto.parent_task_id)
            if parent:
                depth = parent.depth + 1
                parent_path = str(parent.path)

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
            parent_task_id=dto.parent_task_id,
            order_index=order_index,
            depth=depth,
            path=Ltree("placeholder"),
        )
        self.session.add(task)
        await self.session.flush()

        task_segment = str(task.id).replace("-", "_")
        path_str = f"{parent_path}.{task_segment}" if parent_path else task_segment
        task.path = Ltree(path_str)
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
            .where(Task.parent_task_id.is_(None))
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

    async def list_subtasks(self, parent_task_id: UUID) -> list[Task]:
        result = await self.session.execute(
            select(Task)
            .where(Task.parent_task_id == parent_task_id)
            .where(Task.deleted_at.is_(None))
            .order_by(Task.order_index)
        )
        return list(result.scalars().all())

    async def count_subtasks(self, parent_task_id: UUID) -> int:
        result = await self.session.execute(
            select(func.count())
            .select_from(Task)
            .where(Task.parent_task_id == parent_task_id)
            .where(Task.deleted_at.is_(None))
        )
        return result.scalar_one()

    async def get_max_order_index(self, list_id: UUID) -> float:
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

    async def promote(self, task: Task) -> Task:
        task.parent_task_id = None
        task.depth = 0
        task.path = Ltree(str(task.id).replace("-", "_"))
        await self.session.flush()
        return task

    async def soft_delete(self, task: Task) -> None:
        task.soft_delete()
        await self.session.flush()
