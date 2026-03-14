import re
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.project import Project
from app.features.projects.schemas import CreateProjectDTO, UpdateProjectDTO


def _make_prefix(name: str) -> str:
    clean = re.sub(r"[^A-Za-z0-9 ]", "", name).upper()
    words = clean.split()
    if len(words) > 1:
        prefix = "".join(w[0] for w in words if w)[:4]
    else:
        prefix = re.sub(r"[^A-Z]", "", clean)[:4]
    return prefix or "TSK"


class ProjectRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, dto: CreateProjectDTO) -> Project:
        prefix = (dto.task_prefix or _make_prefix(dto.name)).upper().strip()[:10] or "TSK"
        project = Project(
            workspace_id=dto.workspace_id,
            name=dto.name,
            description=dto.description,
            task_prefix=prefix,
            next_task_number=1,
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
        if dto.task_prefix is not None:
            project.task_prefix = dto.task_prefix.upper().strip()[:10] or project.task_prefix
        await self.session.flush()
        return project

    async def claim_task_number(self, project_id: UUID) -> tuple[int, str]:
        """Atomically increment next_task_number and return (task_number, task_prefix)."""
        result = await self.session.execute(
            update(Project)
            .where(Project.id == project_id)
            .values(next_task_number=Project.next_task_number + 1)
            .returning(Project.next_task_number, Project.task_prefix)
        )
        row = result.one()
        # returning gives the NEW next_task_number; the assigned number is new - 1
        return row.next_task_number - 1, row.task_prefix

    async def soft_delete(self, project: Project) -> None:
        project.soft_delete()
        await self.session.flush()
