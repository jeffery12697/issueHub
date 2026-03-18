from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.security import get_current_user
from app.features.epics.repository import EpicRepository
from app.features.epics.service import EpicService
from app.features.epics.schemas import CreateEpicRequest, UpdateEpicRequest, EpicResponse
from app.features.projects.repository import ProjectRepository
from app.features.tasks.schemas import TaskResponse
from app.features.workspaces.repository import WorkspaceRepository
from app.models.user import User

router = APIRouter(tags=["epics"])


def get_service(session: AsyncSession = Depends(get_session)) -> EpicService:
    return EpicService(
        repo=EpicRepository(session),
        project_repo=ProjectRepository(session),
        workspace_repo=WorkspaceRepository(session),
    )


@router.get("/projects/{project_id}/epics", response_model=list[EpicResponse])
async def list_epics(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    service: EpicService = Depends(get_service),
):
    return await service.list_for_project(project_id, user_id=current_user.id)


@router.post(
    "/projects/{project_id}/epics",
    response_model=EpicResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_epic(
    project_id: UUID,
    body: CreateEpicRequest,
    current_user: User = Depends(get_current_user),
    service: EpicService = Depends(get_service),
    session: AsyncSession = Depends(get_session),
):
    epic = await service.create(project_id, body, created_by=current_user.id)
    await session.commit()
    total, done = await service.repo.task_counts(epic.id)
    r = EpicResponse.model_validate(epic)
    return r.model_copy(update={"task_count": total, "done_count": done})


@router.get("/epics/{epic_id}", response_model=EpicResponse)
async def get_epic(
    epic_id: UUID,
    current_user: User = Depends(get_current_user),
    service: EpicService = Depends(get_service),
):
    return await service.get_with_counts(epic_id, user_id=current_user.id)


@router.patch("/epics/{epic_id}", response_model=EpicResponse)
async def update_epic(
    epic_id: UUID,
    body: UpdateEpicRequest,
    current_user: User = Depends(get_current_user),
    service: EpicService = Depends(get_service),
    session: AsyncSession = Depends(get_session),
):
    result = await service.update(epic_id, body.to_dto(), actor_id=current_user.id)
    await session.commit()
    return result


@router.delete("/epics/{epic_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_epic(
    epic_id: UUID,
    current_user: User = Depends(get_current_user),
    service: EpicService = Depends(get_service),
    session: AsyncSession = Depends(get_session),
):
    await service.delete(epic_id, actor_id=current_user.id)
    await session.commit()


@router.get("/epics/{epic_id}/tasks", response_model=list[TaskResponse])
async def list_epic_tasks(
    epic_id: UUID,
    current_user: User = Depends(get_current_user),
    service: EpicService = Depends(get_service),
):
    tasks = await service.list_tasks(epic_id, user_id=current_user.id)
    return [TaskResponse.model_validate(t) for t in tasks]
