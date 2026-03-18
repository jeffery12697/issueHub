from uuid import UUID

from fastapi import HTTPException

from app.features.dashboard.repository import DashboardRepository
from app.features.dashboard.schemas import CreateWidgetDTO
from app.models.dashboard_widget import DashboardWidget


class DashboardService:
    def __init__(self, repo: DashboardRepository):
        self.repo = repo

    async def list_widgets(
        self, workspace_id: UUID, is_admin: bool
    ) -> list[DashboardWidget]:
        return await self.repo.list_for_workspace(
            workspace_id, members_only=not is_admin
        )

    async def create_widget(self, dto: CreateWidgetDTO) -> DashboardWidget:
        return await self.repo.create(dto)

    async def update_widget(
        self,
        widget_id: UUID,
        workspace_id: UUID,
        config: dict | None = None,
        visible_to_members: bool | None = None,
        order_index: int | None = None,
    ) -> DashboardWidget:
        widget = await self.repo.get_by_id(widget_id)
        if not widget or widget.workspace_id != workspace_id:
            raise HTTPException(status_code=404, detail="Widget not found")
        updates = {}
        if config is not None:
            updates["config"] = config
        if visible_to_members is not None:
            updates["visible_to_members"] = visible_to_members
        if order_index is not None:
            updates["order_index"] = order_index
        return await self.repo.update(widget, **updates)

    async def delete_widget(self, widget_id: UUID, workspace_id: UUID) -> None:
        widget = await self.repo.get_by_id(widget_id)
        if not widget or widget.workspace_id != workspace_id:
            raise HTTPException(status_code=404, detail="Widget not found")
        await self.repo.delete(widget)

    async def reorder_widgets(
        self, workspace_id: UUID, widget_ids: list[UUID]
    ) -> list[DashboardWidget]:
        await self.repo.reorder(workspace_id, widget_ids)
        return await self.repo.list_for_workspace(workspace_id)

    async def get_widget_data(self, widget_id: UUID, workspace_id: UUID) -> dict:
        widget = await self.repo.get_by_id(widget_id)
        if not widget or widget.workspace_id != workspace_id:
            raise HTTPException(status_code=404, detail="Widget not found")

        project_id: UUID | None = None
        if widget.config.get("project_id"):
            project_id = UUID(widget.config["project_id"])

        if widget.widget_type == "completion_rate":
            return await self.repo.completion_rate_data(workspace_id, project_id)
        elif widget.widget_type == "overdue_count":
            return await self.repo.overdue_count_data(workspace_id, project_id)
        elif widget.widget_type == "member_workload":
            members = await self.repo.member_workload_data(workspace_id, project_id)
            return {"members": members}
        else:
            raise HTTPException(status_code=400, detail="Unknown widget type")
