from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.project import Project
from app.features.projects.schemas import CreateProjectDTO, UpdateProjectDTO


class ProjectRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, dto: CreateProjectDTO) -> Project:
        project = Project(
            workspace_id=dto.workspace_id,
            name=dto.name,
            description=dto.description,
        )
        self.session.add(project)
        await self.session.flush()
        return project

    async def get_by_id(self, project_id: UUID) -> Project | None:
        result = await self.session.execute(
            select(Project)
            .where(Project.id == project_id)
            .where(Project.deleted_at.is_(None))
        )
        return result.scalar_one_or_none()

    async def list_for_workspace(self, workspace_id: UUID) -> list[Project]:
        result = await self.session.execute(
            select(Project)
            .where(Project.workspace_id == workspace_id)
            .where(Project.deleted_at.is_(None))
            .order_by(Project.created_at)
        )
        return list(result.scalars().all())

    async def update(self, project: Project, dto: UpdateProjectDTO) -> Project:
        if dto.name is not None:
            project.name = dto.name
        if dto.description is not None:
            project.description = dto.description
        await self.session.flush()
        return project

    async def soft_delete(self, project: Project) -> None:
        project.soft_delete()
        await self.session.flush()
