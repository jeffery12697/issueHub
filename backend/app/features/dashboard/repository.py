from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.dashboard_widget import DashboardWidget
from app.features.dashboard.schemas import CreateWidgetDTO


class DashboardRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def list_for_workspace(
        self, workspace_id: UUID, members_only: bool = False
    ) -> list[DashboardWidget]:
        q = (
            select(DashboardWidget)
            .where(DashboardWidget.workspace_id == workspace_id)
            .order_by(DashboardWidget.order_index)
        )
        if members_only:
            q = q.where(DashboardWidget.visible_to_members.is_(True))
        result = await self.session.execute(q)
        return list(result.scalars().all())

    async def get_by_id(self, widget_id: UUID) -> DashboardWidget | None:
        return await self.session.get(DashboardWidget, widget_id)

    async def create(self, dto: CreateWidgetDTO) -> DashboardWidget:
        widget = DashboardWidget(
            workspace_id=dto.workspace_id,
            widget_type=dto.widget_type,
            config=dto.config,
            order_index=dto.order_index,
            visible_to_members=dto.visible_to_members,
        )
        self.session.add(widget)
        await self.session.flush()
        return widget

    async def update(self, widget: DashboardWidget, **kwargs) -> DashboardWidget:
        for key, value in kwargs.items():
            if value is not None:
                setattr(widget, key, value)
        await self.session.flush()
        return widget

    async def delete(self, widget: DashboardWidget) -> None:
        await self.session.delete(widget)
        await self.session.flush()

    async def reorder(self, workspace_id: UUID, widget_ids: list[UUID]) -> None:
        for i, wid in enumerate(widget_ids):
            result = await self.session.execute(
                select(DashboardWidget).where(
                    DashboardWidget.id == wid,
                    DashboardWidget.workspace_id == workspace_id,
                )
            )
            widget = result.scalar_one_or_none()
            if widget:
                widget.order_index = i
        await self.session.flush()

    # --- Data queries ---

    async def completion_rate_data(
        self, workspace_id: UUID, project_id: UUID | None = None
    ) -> dict:
        from app.models.list_ import List
        from app.models.list_status import ListStatus
        from app.models.task import Task

        base_q = (
            select(Task.id)
            .where(Task.list_id.isnot(None))
            .where(Task.deleted_at.is_(None))
            .where(Task.parent_task_id.is_(None))
            .where(Task.workspace_id == workspace_id)
        )
        if project_id:
            base_q = base_q.join(List, List.id == Task.list_id).where(List.project_id == project_id)

        total_result = await self.session.execute(
            select(func.count()).select_from(base_q.subquery())
        )
        total = total_result.scalar() or 0

        done_q = (
            select(Task.id)
            .join(ListStatus, ListStatus.id == Task.status_id)
            .where(Task.list_id.isnot(None))
            .where(Task.deleted_at.is_(None))
            .where(Task.parent_task_id.is_(None))
            .where(Task.workspace_id == workspace_id)
            .where(ListStatus.category == "done")
            .where(ListStatus.deleted_at.is_(None))
        )
        if project_id:
            done_q = done_q.join(List, List.id == Task.list_id).where(List.project_id == project_id)

        done_result = await self.session.execute(
            select(func.count()).select_from(done_q.subquery())
        )
        done = done_result.scalar() or 0
        rate = round(done / total * 100) if total > 0 else 0
        return {"total": total, "done": done, "rate": rate}

    async def overdue_count_data(
        self, workspace_id: UUID, project_id: UUID | None = None
    ) -> dict:
        from app.models.list_ import List
        from app.models.list_status import ListStatus
        from app.models.task import Task

        now = datetime.now(timezone.utc)
        q = (
            select(Task.id)
            .outerjoin(ListStatus, ListStatus.id == Task.status_id)
            .where(Task.list_id.isnot(None))
            .where(Task.deleted_at.is_(None))
            .where(Task.due_date < now)
            .where(Task.workspace_id == workspace_id)
            .where(
                or_(
                    Task.status_id.is_(None),
                    ListStatus.category.notin_(["done", "cancelled"]),
                )
            )
        )
        if project_id:
            q = q.join(List, List.id == Task.list_id).where(List.project_id == project_id)

        result = await self.session.execute(select(func.count()).select_from(q.subquery()))
        return {"count": result.scalar() or 0}

    async def member_workload_data(
        self, workspace_id: UUID, project_id: UUID | None = None
    ) -> list[dict]:
        from app.models.list_ import List
        from app.models.list_status import ListStatus
        from app.models.task import Task
        from app.models.user import User
        from app.models.workspace import WorkspaceMember

        member_result = await self.session.execute(
            select(User.id, User.display_name)
            .join(WorkspaceMember, WorkspaceMember.user_id == User.id)
            .where(WorkspaceMember.workspace_id == workspace_id)
        )
        members = member_result.all()

        workload = []
        for member_id, display_name in members:
            q = (
                select(func.count(Task.id))
                .outerjoin(ListStatus, ListStatus.id == Task.status_id)
                .where(Task.deleted_at.is_(None))
                .where(Task.list_id.isnot(None))
                .where(Task.workspace_id == workspace_id)
                .where(Task.assignee_ids.any(member_id))
                .where(
                    or_(
                        Task.status_id.is_(None),
                        ListStatus.category.notin_(["done", "cancelled"]),
                    )
                )
            )
            if project_id:
                q = q.join(List, List.id == Task.list_id).where(List.project_id == project_id)

            count_result = await self.session.execute(q)
            workload.append(
                {
                    "user_id": str(member_id),
                    "display_name": display_name,
                    "open_task_count": count_result.scalar() or 0,
                }
            )

        return sorted(workload, key=lambda x: x["open_task_count"], reverse=True)
