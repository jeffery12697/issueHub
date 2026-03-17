from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.saved_view import SavedView


class SavedViewRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def list_for_list(self, list_id: UUID, user_id: UUID) -> list[SavedView]:
        result = await self.session.execute(
            select(SavedView)
            .where(SavedView.list_id == list_id)
            .where(SavedView.user_id == user_id)
            .order_by(SavedView.created_at.asc())
        )
        return list(result.scalars().all())

    async def list_for_project(self, project_id: UUID, user_id: UUID) -> list[SavedView]:
        result = await self.session.execute(
            select(SavedView)
            .where(SavedView.project_id == project_id)
            .where(SavedView.user_id == user_id)
            .order_by(SavedView.created_at.asc())
        )
        return list(result.scalars().all())

    async def create(
        self,
        user_id: UUID,
        name: str,
        filters_json: dict,
        list_id: UUID | None = None,
        project_id: UUID | None = None,
    ) -> SavedView:
        view = SavedView(
            user_id=user_id,
            name=name,
            filters_json=filters_json,
            list_id=list_id,
            project_id=project_id,
        )
        self.session.add(view)
        await self.session.flush()
        return view

    async def get(self, view_id: UUID, user_id: UUID) -> SavedView | None:
        result = await self.session.execute(
            select(SavedView)
            .where(SavedView.id == view_id)
            .where(SavedView.user_id == user_id)
        )
        return result.scalar_one_or_none()

    async def delete(self, view: SavedView) -> None:
        await self.session.execute(delete(SavedView).where(SavedView.id == view.id))
        await self.session.flush()
