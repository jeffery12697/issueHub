from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.security import get_current_user
from app.features.saved_views.repository import SavedViewRepository
from app.features.saved_views.schemas import SavedViewCreate, SavedViewResponse
from app.models.user import User

router = APIRouter(tags=["saved_views"])


@router.get("/lists/{list_id}/saved-views", response_model=list[SavedViewResponse])
async def list_saved_views_for_list(
    list_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    repo = SavedViewRepository(session)
    return await repo.list_for_list(list_id, current_user.id)


@router.post(
    "/lists/{list_id}/saved-views",
    response_model=SavedViewResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_saved_view_for_list(
    list_id: UUID,
    body: SavedViewCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    repo = SavedViewRepository(session)
    view = await repo.create(current_user.id, body.name, body.filters_json, list_id=list_id)
    await session.commit()
    return view


@router.get("/projects/{project_id}/saved-views", response_model=list[SavedViewResponse])
async def list_saved_views_for_project(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    repo = SavedViewRepository(session)
    return await repo.list_for_project(project_id, current_user.id)


@router.post(
    "/projects/{project_id}/saved-views",
    response_model=SavedViewResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_saved_view_for_project(
    project_id: UUID,
    body: SavedViewCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    repo = SavedViewRepository(session)
    view = await repo.create(current_user.id, body.name, body.filters_json, project_id=project_id)
    await session.commit()
    return view


@router.delete("/saved-views/{view_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_saved_view(
    view_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    repo = SavedViewRepository(session)
    view = await repo.get(view_id, current_user.id)
    if not view:
        raise HTTPException(status_code=404, detail="View not found")
    await repo.delete(view)
    await session.commit()


@router.patch("/saved-views/{view_id}/set-default", response_model=SavedViewResponse)
async def set_default_saved_view(
    view_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    repo = SavedViewRepository(session)
    view = await repo.set_default(view_id, current_user.id)
    if not view:
        raise HTTPException(status_code=404, detail="View not found")
    await session.commit()
    return view
