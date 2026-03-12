from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.security import get_current_user
from app.features.projects.repository import ProjectRepository
from app.features.projects.service import ProjectService
from app.features.projects.schemas import (
    CreateProjectRequest,
    UpdateProjectRequest,
    ProjectResponse,
)
from app.features.workspaces.repository import WorkspaceRepository
from app.models.user import User

router = APIRouter(tags=["projects"])


def get_service(session: AsyncSession = Depends(get_session)) -> ProjectService:
    return ProjectService(
        repo=ProjectRepository(session),
        workspace_repo=WorkspaceRepository(session),
    )


@router.get("/workspaces/{workspace_id}/projects", response_model=list[ProjectResponse])
async def list_projects(
    workspace_id: UUID,
    current_user: User = Depends(get_current_user),
    service: ProjectService = Depends(get_service),
):
    projects = await service.list_for_workspace(workspace_id, user_id=current_user.id)
    return [ProjectResponse.model_validate(p) for p in projects]


@router.post("/workspaces/{workspace_id}/projects", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    workspace_id: UUID,
    body: CreateProjectRequest,
    current_user: User = Depends(get_current_user),
    service: ProjectService = Depends(get_service),
    session: AsyncSession = Depends(get_session),
):
    project = await service.create(body.to_dto(workspace_id, created_by=current_user.id))
    await session.commit()
    return ProjectResponse.model_validate(project)


@router.get("/projects/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    service: ProjectService = Depends(get_service),
):
    project = await service.get_or_404(project_id)
    return ProjectResponse.model_validate(project)


@router.patch("/projects/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: UUID,
    body: UpdateProjectRequest,
    current_user: User = Depends(get_current_user),
    service: ProjectService = Depends(get_service),
    session: AsyncSession = Depends(get_session),
):
    project = await service.update(project_id, body.to_dto(), actor_id=current_user.id)
    await session.commit()
    return ProjectResponse.model_validate(project)


@router.delete("/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    service: ProjectService = Depends(get_service),
    session: AsyncSession = Depends(get_session),
):
    await service.delete(project_id, actor_id=current_user.id)
    await session.commit()
