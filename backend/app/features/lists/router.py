from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.security import get_current_user
from app.features.lists.repository import ListRepository
from app.features.lists.service import ListService
from app.features.lists.schemas import (
    CreateListRequest,
    UpdateListRequest,
    SetVisibilityRequest,
    CreateStatusRequest,
    UpdateStatusRequest,
    ReorderStatusRequest,
    ListResponse,
    ListWithStatusesResponse,
    ListStatusResponse,
)
from app.features.workspaces.repository import WorkspaceRepository
from app.features.projects.repository import ProjectRepository
from app.features.teams.repository import TeamRepository
from app.models.user import User

router = APIRouter(tags=["lists"])


def get_service(session: AsyncSession = Depends(get_session)) -> ListService:
    return ListService(
        repo=ListRepository(session),
        workspace_repo=WorkspaceRepository(session),
        project_repo=ProjectRepository(session),
        team_repo=TeamRepository(session),
    )


# --- List endpoints ---

@router.get("/workspaces/{workspace_id}/lists", response_model=list[ListResponse])
async def list_workspace_lists(
    workspace_id: UUID,
    current_user: User = Depends(get_current_user),
    service: ListService = Depends(get_service),
):
    lists = await service.list_for_workspace(workspace_id, user_id=current_user.id)
    return [ListResponse.model_validate(l) for l in lists]


@router.get("/projects/{project_id}/lists", response_model=list[ListResponse])
async def list_lists(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    service: ListService = Depends(get_service),
):
    lists = await service.list_for_project(project_id, user_id=current_user.id)
    return [ListResponse.model_validate(l) for l in lists]


@router.post("/projects/{project_id}/lists", response_model=ListResponse, status_code=status.HTTP_201_CREATED)
async def create_list(
    project_id: UUID,
    body: CreateListRequest,
    current_user: User = Depends(get_current_user),
    service: ListService = Depends(get_service),
    session: AsyncSession = Depends(get_session),
):
    list_ = await service.create(body.to_dto(project_id, created_by=current_user.id))
    await session.commit()
    return ListResponse.model_validate(list_)


@router.get("/lists/{list_id}", response_model=ListWithStatusesResponse)
async def get_list(
    list_id: UUID,
    current_user: User = Depends(get_current_user),
    service: ListService = Depends(get_service),
):
    list_ = await service.get_or_404(list_id, load_statuses=True)
    return ListWithStatusesResponse.model_validate(list_)


@router.patch("/lists/{list_id}", response_model=ListResponse)
async def update_list(
    list_id: UUID,
    body: UpdateListRequest,
    current_user: User = Depends(get_current_user),
    service: ListService = Depends(get_service),
    session: AsyncSession = Depends(get_session),
):
    list_ = await service.update(list_id, body.to_dto(), actor_id=current_user.id)
    await session.commit()
    return ListResponse.model_validate(list_)


@router.patch("/lists/{list_id}/visibility", response_model=ListResponse)
async def set_visibility(
    list_id: UUID,
    body: SetVisibilityRequest,
    current_user: User = Depends(get_current_user),
    service: ListService = Depends(get_service),
    session: AsyncSession = Depends(get_session),
):
    list_ = await service.set_visibility(list_id, body.to_dto(), actor_id=current_user.id)
    await session.commit()
    return ListResponse.model_validate(list_)


@router.delete("/lists/{list_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_list(
    list_id: UUID,
    current_user: User = Depends(get_current_user),
    service: ListService = Depends(get_service),
    session: AsyncSession = Depends(get_session),
):
    await service.delete(list_id, actor_id=current_user.id)
    await session.commit()


# --- Status endpoints ---

@router.get("/lists/{list_id}/statuses", response_model=list[ListStatusResponse])
async def list_statuses(
    list_id: UUID,
    current_user: User = Depends(get_current_user),
    service: ListService = Depends(get_service),
):
    statuses = await service.list_statuses(list_id)
    return [ListStatusResponse.model_validate(s) for s in statuses]


@router.post("/lists/{list_id}/statuses", response_model=ListStatusResponse, status_code=status.HTTP_201_CREATED)
async def create_status(
    list_id: UUID,
    body: CreateStatusRequest,
    current_user: User = Depends(get_current_user),
    service: ListService = Depends(get_service),
    session: AsyncSession = Depends(get_session),
):
    status_ = await service.create_status(
        list_id,
        dto=body.to_dto(list_id, order_index=0),  # order_index computed in service
        actor_id=current_user.id,
    )
    await session.commit()
    return ListStatusResponse.model_validate(status_)


@router.patch("/lists/{list_id}/statuses/{status_id}", response_model=ListStatusResponse)
async def update_status(
    list_id: UUID,
    status_id: UUID,
    body: UpdateStatusRequest,
    current_user: User = Depends(get_current_user),
    service: ListService = Depends(get_service),
    session: AsyncSession = Depends(get_session),
):
    status_ = await service.update_status(list_id, status_id, body.to_dto(), actor_id=current_user.id)
    await session.commit()
    return ListStatusResponse.model_validate(status_)


@router.delete("/lists/{list_id}/statuses/{status_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_status(
    list_id: UUID,
    status_id: UUID,
    current_user: User = Depends(get_current_user),
    service: ListService = Depends(get_service),
    session: AsyncSession = Depends(get_session),
):
    await service.delete_status(list_id, status_id, actor_id=current_user.id)
    await session.commit()


@router.post("/lists/{list_id}/statuses/{status_id}/reorder", response_model=list[ListStatusResponse])
async def reorder_status(
    list_id: UUID,
    status_id: UUID,
    body: ReorderStatusRequest,
    current_user: User = Depends(get_current_user),
    service: ListService = Depends(get_service),
    session: AsyncSession = Depends(get_session),
):
    statuses = await service.reorder_status(list_id, body.to_dto(status_id), actor_id=current_user.id)
    await session.commit()
    return [ListStatusResponse.model_validate(s) for s in statuses]
