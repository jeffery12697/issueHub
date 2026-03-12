from uuid import UUID

from fastapi import HTTPException, status

from app.features.projects.repository import ProjectRepository
from app.features.projects.schemas import CreateProjectDTO, UpdateProjectDTO
from app.features.workspaces.repository import WorkspaceRepository
from app.models.project import Project
from app.models.workspace import WorkspaceRole


class ProjectService:
    def __init__(self, repo: ProjectRepository, workspace_repo: WorkspaceRepository):
        self.repo = repo
        self.workspace_repo = workspace_repo

    async def create(self, dto: CreateProjectDTO) -> Project:
        await self._require_workspace_member(dto.workspace_id, dto.created_by)
        return await self.repo.create(dto)

    async def get_or_404(self, project_id: UUID) -> Project:
        project = await self.repo.get_by_id(project_id)
        if not project:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
        return project

    async def list_for_workspace(self, workspace_id: UUID, user_id: UUID) -> list[Project]:
        await self._require_workspace_member(workspace_id, user_id)
        return await self.repo.list_for_workspace(workspace_id)

    async def update(self, project_id: UUID, dto: UpdateProjectDTO, actor_id: UUID) -> Project:
        project = await self.get_or_404(project_id)
        await self._require_role(project.workspace_id, actor_id, {WorkspaceRole.owner, WorkspaceRole.admin})
        return await self.repo.update(project, dto)

    async def delete(self, project_id: UUID, actor_id: UUID) -> None:
        project = await self.get_or_404(project_id)
        await self._require_role(project.workspace_id, actor_id, {WorkspaceRole.owner, WorkspaceRole.admin})
        await self.repo.soft_delete(project)

    async def _require_workspace_member(self, workspace_id: UUID, user_id: UUID) -> None:
        member = await self.workspace_repo.get_member(workspace_id, user_id)
        if not member:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a workspace member")

    async def _require_role(self, workspace_id: UUID, user_id: UUID, allowed: set[WorkspaceRole]) -> None:
        member = await self.workspace_repo.get_member(workspace_id, user_id)
        if not member or member.role not in allowed:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
