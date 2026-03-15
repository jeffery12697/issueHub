from datetime import datetime
from uuid import UUID

from sqlalchemy import select, update, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy_utils.types.ltree import Ltree

from app.models.task import Task, Priority
from app.features.tasks.schemas import CreateTaskDTO, UpdateTaskDTO


def _try_float(v: str) -> float | None:
    try:
        return float(v)
    except (ValueError, TypeError):
        return None


class TaskRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(
        self,
        dto: CreateTaskDTO,
        order_index: float,
        task_number: int | None = None,
        task_key: str | None = None,
    ) -> Task:
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
            start_date=dto.start_date,
            story_points=dto.story_points,
            parent_task_id=dto.parent_task_id,
            order_index=order_index,
            depth=depth,
            path=Ltree("placeholder"),
            task_number=task_number,
            task_key=task_key,
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
        status_ids_not: list[UUID] | None = None,
        priority: Priority | None = None,
        priorities_not: list[Priority] | None = None,
        assignee_id: UUID | None = None,
        cf_filters: dict[UUID, str] | None = None,
        include_subtasks: bool = False,
        page: int = 1,
        page_size: int = 0,
    ) -> tuple[list[Task], int]:
        from sqlalchemy import or_, any_
        from app.models.custom_field import CustomFieldValue
        q = (
            select(Task)
            .where(Task.list_id == list_id)
            .where(Task.deleted_at.is_(None))
        )
        if not include_subtasks:
            q = q.where(Task.parent_task_id.is_(None))
        if status_id:
            q = q.where(Task.status_id == status_id)
        if status_ids_not:
            q = q.where(Task.status_id.notin_(status_ids_not))
        if priority:
            q = q.where(Task.priority == priority)
        if priorities_not:
            q = q.where(Task.priority.notin_(priorities_not))
        if assignee_id:
            q = q.where(Task.assignee_ids.any(assignee_id))
        if cf_filters:
            for field_id, value in cf_filters.items():
                q = q.where(
                    select(CustomFieldValue.task_id)
                    .where(CustomFieldValue.task_id == Task.id)
                    .where(CustomFieldValue.field_id == field_id)
                    .where(
                        or_(
                            CustomFieldValue.value_text.ilike(f"%{value}%"),
                            CustomFieldValue.value_number == _try_float(value),
                            CustomFieldValue.value_json.op("->>")('"selected"') == value,
                        )
                    )
                    .correlate(Task)
                    .exists()
                )

        count_result = await self.session.execute(
            select(func.count()).select_from(q.subquery())
        )
        total = count_result.scalar_one()

        q = q.order_by(Task.order_index)
        if page_size > 0:
            q = q.offset((page - 1) * page_size).limit(page_size)
        result = await self.session.execute(q)
        return list(result.scalars().all()), total

    async def list_for_project(
        self,
        project_id: UUID,
        list_id: UUID | None = None,
        priority: Priority | None = None,
        priorities_not: list[Priority] | None = None,
        assignee_id: UUID | None = None,
        include_subtasks: bool = False,
        page: int = 1,
        page_size: int = 0,
    ) -> tuple[list[Task], int]:
        q = (
            select(Task)
            .where(Task.project_id == project_id)
            .where(Task.deleted_at.is_(None))
        )
        if not include_subtasks:
            q = q.where(Task.parent_task_id.is_(None))
        if list_id:
            q = q.where(Task.list_id == list_id)
        if priority:
            q = q.where(Task.priority == priority)
        if priorities_not:
            q = q.where(Task.priority.notin_(priorities_not))
        if assignee_id:
            q = q.where(Task.assignee_ids.any(assignee_id))

        count_result = await self.session.execute(
            select(func.count()).select_from(q.subquery())
        )
        total = count_result.scalar_one()

        q = q.order_by(Task.list_id, Task.order_index)
        if page_size > 0:
            q = q.offset((page - 1) * page_size).limit(page_size)
        result = await self.session.execute(q)
        return list(result.scalars().all()), total

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
        from app.features.tasks.schemas import _UNSET
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
        if dto.reviewer_id is not _UNSET:
            task.reviewer_id = dto.reviewer_id  # None clears it, UUID sets it
        if dto.due_date is not None:
            task.due_date = dto.due_date
            task.overdue_notified = False  # reset so the next overdue scan can fire again
        if dto.start_date is not None:
            task.start_date = dto.start_date
        if dto.story_points is not None:
            task.story_points = dto.story_points
        await self.session.flush()
        return task

    async def list_my_tasks(
        self,
        workspace_id: UUID,
        user_id: UUID,
        status_id: UUID | None = None,
        priority: Priority | None = None,
    ) -> list[Task]:
        q = (
            select(Task)
            .where(Task.workspace_id == workspace_id)
            .where(Task.deleted_at.is_(None))
            .where(Task.assignee_ids.any(user_id))
        )
        if status_id:
            q = q.where(Task.status_id == status_id)
        if priority:
            q = q.where(Task.priority == priority)
        q = q.order_by(Task.due_date.asc().nulls_last(), Task.order_index)
        result = await self.session.execute(q)
        return list(result.scalars().all())

    async def promote(self, task: Task) -> Task:
        task.parent_task_id = None
        task.depth = 0
        task.path = Ltree(str(task.id).replace("-", "_"))
        await self.session.flush()
        return task

    async def soft_delete(self, task: Task) -> None:
        task.soft_delete()
        await self.session.flush()

    async def search(self, workspace_id: UUID, q: str, limit: int = 50) -> list[Task]:
        pattern = f"%{q}%"
        result = await self.session.execute(
            select(Task)
            .where(Task.workspace_id == workspace_id)
            .where(Task.deleted_at.is_(None))
            .where(
                (Task.title.ilike(pattern)) | (Task.description.ilike(pattern))
            )
            .order_by(Task.created_at.desc())
            .limit(limit)
        )
        return list(result.scalars().all())

    async def bulk_update(self, task_ids: list[UUID], status_id: UUID | None, priority: str | None) -> int:
        values: dict = {}
        if status_id is not None:
            values["status_id"] = status_id
        if priority is not None:
            values["priority"] = priority
        if not values:
            return 0
        result = await self.session.execute(
            update(Task)
            .where(Task.id.in_(task_ids))
            .where(Task.deleted_at.is_(None))
            .values(**values)
        )
        await self.session.flush()
        return result.rowcount

    async def bulk_soft_delete(self, task_ids: list[UUID]) -> int:
        result = await self.session.execute(
            update(Task)
            .where(Task.id.in_(task_ids))
            .where(Task.deleted_at.is_(None))
            .values(deleted_at=datetime.utcnow())
        )
        await self.session.flush()
        return result.rowcount

    async def get_newly_overdue(self) -> list[Task]:
        """Return tasks that are past their due date and haven't been notified yet."""
        from sqlalchemy import text as sa_text
        result = await self.session.execute(
            select(Task)
            .where(Task.deleted_at.is_(None))
            .where(Task.due_date.isnot(None))
            .where(Task.due_date < func.now())
            .where(Task.overdue_notified == False)  # noqa: E712
        )
        return list(result.scalars().all())

    async def mark_overdue_notified(self, task_id: UUID) -> None:
        await self.session.execute(
            update(Task)
            .where(Task.id == task_id)
            .values(overdue_notified=True)
        )
        await self.session.flush()

    async def analytics_for_workspace(self, workspace_id: UUID) -> dict:
        from sqlalchemy import text as sa_text

        total_result = await self.session.execute(
            select(func.count())
            .select_from(Task)
            .where(Task.workspace_id == workspace_id)
            .where(Task.deleted_at.is_(None))
        )
        total = total_result.scalar_one()

        overdue_result = await self.session.execute(
            select(func.count())
            .select_from(Task)
            .where(Task.workspace_id == workspace_id)
            .where(Task.deleted_at.is_(None))
            .where(Task.due_date < func.now())
        )
        overdue = overdue_result.scalar_one()

        by_status_result = await self.session.execute(
            select(Task.status_id, func.count().label("count"), func.coalesce(func.sum(Task.story_points), 0).label("story_points"))
            .where(Task.workspace_id == workspace_id)
            .where(Task.deleted_at.is_(None))
            .group_by(Task.status_id)
        )
        by_status = [{"status_id": row.status_id, "count": row.count, "story_points": row.story_points} for row in by_status_result.all()]

        total_sp_result = await self.session.execute(
            select(func.coalesce(func.sum(Task.story_points), 0))
            .where(Task.workspace_id == workspace_id)
            .where(Task.deleted_at.is_(None))
        )
        total_story_points = total_sp_result.scalar_one()

        return {"total": total, "overdue": overdue, "by_status": by_status, "total_story_points": total_story_points}

    async def analytics_for_project(self, project_id: UUID) -> dict:
        total_result = await self.session.execute(
            select(func.count())
            .select_from(Task)
            .where(Task.project_id == project_id)
            .where(Task.deleted_at.is_(None))
        )
        total = total_result.scalar_one()

        overdue_result = await self.session.execute(
            select(func.count())
            .select_from(Task)
            .where(Task.project_id == project_id)
            .where(Task.deleted_at.is_(None))
            .where(Task.due_date < func.now())
        )
        overdue = overdue_result.scalar_one()

        by_status_result = await self.session.execute(
            select(Task.status_id, func.count().label("count"), func.coalesce(func.sum(Task.story_points), 0).label("story_points"))
            .where(Task.project_id == project_id)
            .where(Task.deleted_at.is_(None))
            .group_by(Task.status_id)
        )
        by_status = [{"status_id": row.status_id, "count": row.count, "story_points": row.story_points} for row in by_status_result.all()]

        total_sp_result = await self.session.execute(
            select(func.coalesce(func.sum(Task.story_points), 0))
            .where(Task.project_id == project_id)
            .where(Task.deleted_at.is_(None))
        )
        total_story_points = total_sp_result.scalar_one()

        return {"total": total, "overdue": overdue, "by_status": by_status, "total_story_points": total_story_points}
