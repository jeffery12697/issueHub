from uuid import UUID

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.status_mapping import StatusMapping


class StatusMappingRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def list_for_project(self, project_id: UUID) -> list[StatusMapping]:
        result = await self.session.execute(
            select(StatusMapping).where(StatusMapping.project_id == project_id)
        )
        return list(result.scalars().all())

    async def get_mapping(
        self, from_list_id: UUID, to_list_id: UUID, from_status_id: UUID
    ) -> StatusMapping | None:
        result = await self.session.execute(
            select(StatusMapping)
            .where(StatusMapping.from_list_id == from_list_id)
            .where(StatusMapping.to_list_id == to_list_id)
            .where(StatusMapping.from_status_id == from_status_id)
        )
        return result.scalar_one_or_none()

    async def upsert(
        self,
        project_id: UUID,
        from_list_id: UUID,
        from_status_id: UUID,
        to_list_id: UUID,
        to_status_id: UUID,
    ) -> StatusMapping:
        existing = await self.get_mapping(from_list_id, to_list_id, from_status_id)
        if existing:
            existing.to_status_id = to_status_id
            await self.session.flush()
            return existing
        mapping = StatusMapping(
            project_id=project_id,
            from_list_id=from_list_id,
            from_status_id=from_status_id,
            to_list_id=to_list_id,
            to_status_id=to_status_id,
        )
        self.session.add(mapping)
        await self.session.flush()
        return mapping

    async def delete_by_id(self, mapping_id: UUID) -> bool:
        result = await self.session.execute(
            select(StatusMapping).where(StatusMapping.id == mapping_id)
        )
        mapping = result.scalar_one_or_none()
        if not mapping:
            return False
        await self.session.delete(mapping)
        await self.session.flush()
        return True

    async def delete_for_list_pair(self, from_list_id: UUID, to_list_id: UUID) -> None:
        await self.session.execute(
            delete(StatusMapping)
            .where(StatusMapping.from_list_id == from_list_id)
            .where(StatusMapping.to_list_id == to_list_id)
        )
        await self.session.flush()
