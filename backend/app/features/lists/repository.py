from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.list_ import List
from app.models.list_status import ListStatus
from app.features.lists.schemas import (
    CreateListDTO,
    UpdateListDTO,
    CreateStatusDTO,
    UpdateStatusDTO,
)


class ListRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, dto: CreateListDTO) -> List:
        list_ = List(
            project_id=dto.project_id,
            name=dto.name,
            description=dto.description,
        )
        self.session.add(list_)
        await self.session.flush()
        return list_

    async def get_by_id(self, list_id: UUID, load_statuses: bool = False) -> List | None:
        q = select(List).where(List.id == list_id).where(List.deleted_at.is_(None))
        if load_statuses:
            q = q.options(selectinload(List.statuses))
        result = await self.session.execute(q)
        return result.scalar_one_or_none()

    async def list_for_project(self, project_id: UUID) -> list[List]:
        result = await self.session.execute(
            select(List)
            .where(List.project_id == project_id)
            .where(List.deleted_at.is_(None))
            .order_by(List.created_at)
        )
        return list(result.scalars().all())

    async def list_for_workspace(self, workspace_id: UUID) -> list[List]:
        from app.models.project import Project
        result = await self.session.execute(
            select(List)
            .join(Project, List.project_id == Project.id)
            .where(Project.workspace_id == workspace_id)
            .where(List.deleted_at.is_(None))
            .where(Project.deleted_at.is_(None))
            .order_by(List.created_at)
        )
        return list(result.scalars().all())

    async def update(self, list_: List, dto: UpdateListDTO) -> List:
        if dto.name is not None:
            list_.name = dto.name
        if dto.description is not None:
            list_.description = dto.description
        await self.session.flush()
        return list_

    async def soft_delete(self, list_: List) -> None:
        list_.soft_delete()
        await self.session.flush()

    async def set_visibility(self, list_: List, team_ids: list) -> List:
        list_.team_ids = team_ids
        await self.session.flush()
        return list_

    async def set_reviewer_ids(self, list_: List, reviewer_ids: list) -> List:
        list_.reviewer_ids = reviewer_ids
        await self.session.flush()
        return list_

    # --- Status management ---

    async def create_status(self, dto: CreateStatusDTO) -> ListStatus:
        status = ListStatus(
            list_id=dto.list_id,
            name=dto.name,
            color=dto.color,
            category=dto.category,
            order_index=dto.order_index,
        )
        self.session.add(status)
        await self.session.flush()
        return status

    async def get_status_by_id(self, status_id: UUID) -> ListStatus | None:
        result = await self.session.execute(
            select(ListStatus)
            .where(ListStatus.id == status_id)
            .where(ListStatus.deleted_at.is_(None))
        )
        return result.scalar_one_or_none()

    async def list_statuses(self, list_id: UUID) -> list[ListStatus]:
        result = await self.session.execute(
            select(ListStatus)
            .where(ListStatus.list_id == list_id)
            .where(ListStatus.deleted_at.is_(None))
            .order_by(ListStatus.order_index)
        )
        return list(result.scalars().all())

    async def update_status(self, status: ListStatus, dto: UpdateStatusDTO) -> ListStatus:
        if dto.name is not None:
            status.name = dto.name
        if dto.color is not None:
            status.color = dto.color
        if dto.is_complete is not None:
            status.is_complete = dto.is_complete
        if dto.category is not None:
            status.category = dto.category
        await self.session.flush()
        return status

    async def update_status_order(self, status: ListStatus, order_index: float) -> ListStatus:
        status.order_index = order_index
        await self.session.flush()
        return status

    async def soft_delete_status(self, status: ListStatus) -> None:
        status.soft_delete()
        await self.session.flush()

    async def rebalance_statuses(self, list_id: UUID) -> None:
        """Rebalance order_index values when gaps get too small (< 0.001)."""
        statuses = await self.list_statuses(list_id)
        for i, status in enumerate(statuses):
            status.order_index = float((i + 1) * 100)
        await self.session.flush()
