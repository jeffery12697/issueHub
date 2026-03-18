from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.security import get_current_user
from app.features.dashboard.repository import DashboardRepository
from app.features.dashboard.service import DashboardService
from app.features.dashboard.schemas import (
    CreateWidgetRequest,
    ReorderRequest,
    UpdateWidgetRequest,
    WidgetResponse,
)
from app.features.workspaces.repository import WorkspaceRepository
from app.models.user import User

router = APIRouter(prefix="/workspaces", tags=["dashboard"])


def get_service(session: AsyncSession = Depends(get_session)) -> DashboardService:
    return DashboardService(repo=DashboardRepository(session))


async def _require_member(
    workspace_id: UUID,
    current_user: User,
    session: AsyncSession,
) -> str:
    repo = WorkspaceRepository(session)
    member = await repo.get_member(workspace_id, current_user.id)
    if not member:
        raise HTTPException(status_code=403, detail="Not a workspace member")
    return member.role


async def _require_admin(
    workspace_id: UUID,
    current_user: User,
    session: AsyncSession,
) -> None:
    role = await _require_member(workspace_id, current_user, session)
    if role not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Admin access required")


@router.get("/{workspace_id}/dashboard", response_model=list[WidgetResponse])
async def list_widgets(
    workspace_id: UUID,
    current_user: User = Depends(get_current_user),
    service: DashboardService = Depends(get_service),
    session: AsyncSession = Depends(get_session),
):
    role = await _require_member(workspace_id, current_user, session)
    is_admin = role in ("owner", "admin")
    widgets = await service.list_widgets(workspace_id, is_admin=is_admin)
    return [WidgetResponse.model_validate(w) for w in widgets]


@router.post(
    "/{workspace_id}/dashboard/widgets",
    response_model=WidgetResponse,
    status_code=201,
)
async def create_widget(
    workspace_id: UUID,
    body: CreateWidgetRequest,
    current_user: User = Depends(get_current_user),
    service: DashboardService = Depends(get_service),
    session: AsyncSession = Depends(get_session),
):
    await _require_admin(workspace_id, current_user, session)
    widget = await service.create_widget(body.to_dto(workspace_id))
    await session.commit()
    return WidgetResponse.model_validate(widget)


@router.patch(
    "/{workspace_id}/dashboard/widgets/{widget_id}",
    response_model=WidgetResponse,
)
async def update_widget(
    workspace_id: UUID,
    widget_id: UUID,
    body: UpdateWidgetRequest,
    current_user: User = Depends(get_current_user),
    service: DashboardService = Depends(get_service),
    session: AsyncSession = Depends(get_session),
):
    await _require_admin(workspace_id, current_user, session)
    config_dict = body.config.model_dump() if body.config is not None else None
    widget = await service.update_widget(
        widget_id,
        workspace_id,
        config=config_dict,
        visible_to_members=body.visible_to_members,
        order_index=body.order_index,
    )
    await session.commit()
    return WidgetResponse.model_validate(widget)


@router.delete(
    "/{workspace_id}/dashboard/widgets/{widget_id}",
    status_code=204,
)
async def delete_widget(
    workspace_id: UUID,
    widget_id: UUID,
    current_user: User = Depends(get_current_user),
    service: DashboardService = Depends(get_service),
    session: AsyncSession = Depends(get_session),
):
    await _require_admin(workspace_id, current_user, session)
    await service.delete_widget(widget_id, workspace_id)
    await session.commit()


@router.put(
    "/{workspace_id}/dashboard/widgets/order",
    response_model=list[WidgetResponse],
)
async def reorder_widgets(
    workspace_id: UUID,
    body: ReorderRequest,
    current_user: User = Depends(get_current_user),
    service: DashboardService = Depends(get_service),
    session: AsyncSession = Depends(get_session),
):
    await _require_admin(workspace_id, current_user, session)
    await _require_member(workspace_id, current_user, session)
    widgets = await service.reorder_widgets(workspace_id, body.widget_ids)
    await session.commit()
    return [WidgetResponse.model_validate(w) for w in widgets]


@router.get("/{workspace_id}/dashboard/widgets/{widget_id}/data")
async def get_widget_data(
    workspace_id: UUID,
    widget_id: UUID,
    current_user: User = Depends(get_current_user),
    service: DashboardService = Depends(get_service),
    session: AsyncSession = Depends(get_session),
):
    await _require_member(workspace_id, current_user, session)
    return await service.get_widget_data(widget_id, workspace_id)
