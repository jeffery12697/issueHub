from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.security import get_current_user
from app.features.tags.repository import TagRepository
from app.features.tags.schemas import (
    AddTagToTaskRequest,
    CreateTagDTO,
    CreateTagRequest,
    TagResponse,
    UpdateTagDTO,
    UpdateTagRequest,
)
from app.features.tags.service import TagService
from app.features.lists.repository import ListRepository
from app.features.tasks.repository import TaskRepository
from app.features.teams.repository import TeamRepository
from app.features.workspaces.repository import WorkspaceRepository
from app.models.user import User

router = APIRouter(tags=["tags"])


def get_service(session: AsyncSession = Depends(get_session)) -> TagService:
    return TagService(
        repo=TagRepository(session),
        workspace_repo=WorkspaceRepository(session),
        list_repo=ListRepository(session),
        task_repo=TaskRepository(session),
        team_repo=TeamRepository(session),
    )


# --- Workspace tag CRUD ---

@router.get(
    "/workspaces/{workspace_id}/tags",
    response_model=list[TagResponse],
)
async def list_tags(
    workspace_id: UUID,
    current_user: User = Depends(get_current_user),
    service: TagService = Depends(get_service),
):
    tags = await service.list_tags(workspace_id, user_id=current_user.id)
    return [TagResponse.model_validate(t) for t in tags]


@router.post(
    "/workspaces/{workspace_id}/tags",
    response_model=TagResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_tag(
    workspace_id: UUID,
    body: CreateTagRequest,
    current_user: User = Depends(get_current_user),
    service: TagService = Depends(get_service),
    session: AsyncSession = Depends(get_session),
):
    dto = CreateTagDTO(workspace_id=workspace_id, name=body.name, color=body.color)
    tag = await service.create(workspace_id, dto, actor_id=current_user.id)
    await session.commit()
    return TagResponse.model_validate(tag)


@router.patch(
    "/workspaces/{workspace_id}/tags/{tag_id}",
    response_model=TagResponse,
)
async def update_tag(
    workspace_id: UUID,
    tag_id: UUID,
    body: UpdateTagRequest,
    current_user: User = Depends(get_current_user),
    service: TagService = Depends(get_service),
    session: AsyncSession = Depends(get_session),
):
    dto = UpdateTagDTO(name=body.name, color=body.color)
    tag = await service.update(workspace_id, tag_id, dto, actor_id=current_user.id)
    await session.commit()
    return TagResponse.model_validate(tag)


@router.delete(
    "/workspaces/{workspace_id}/tags/{tag_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_tag(
    workspace_id: UUID,
    tag_id: UUID,
    current_user: User = Depends(get_current_user),
    service: TagService = Depends(get_service),
    session: AsyncSession = Depends(get_session),
):
    await service.delete(workspace_id, tag_id, actor_id=current_user.id)
    await session.commit()


# --- Task tag assignments ---

@router.get(
    "/tasks/{task_id}/tags",
    response_model=list[TagResponse],
)
async def list_task_tags(
    task_id: UUID,
    current_user: User = Depends(get_current_user),
    service: TagService = Depends(get_service),
):
    tags = await service.list_tags_for_task(task_id, user_id=current_user.id)
    return [TagResponse.model_validate(t) for t in tags]


@router.post(
    "/tasks/{task_id}/tags",
    response_model=TagResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_tag_to_task(
    task_id: UUID,
    body: AddTagToTaskRequest,
    current_user: User = Depends(get_current_user),
    service: TagService = Depends(get_service),
    session: AsyncSession = Depends(get_session),
):
    task_tag = await service.add_tag_to_task(task_id, body.tag_id, actor_id=current_user.id)
    await session.commit()
    tag = await TagRepository(session).get_by_id(task_tag.tag_id)
    return TagResponse.model_validate(tag)


@router.delete(
    "/tasks/{task_id}/tags/{tag_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def remove_tag_from_task(
    task_id: UUID,
    tag_id: UUID,
    current_user: User = Depends(get_current_user),
    service: TagService = Depends(get_service),
    session: AsyncSession = Depends(get_session),
):
    await service.remove_tag_from_task(task_id, tag_id, actor_id=current_user.id)
    await session.commit()
