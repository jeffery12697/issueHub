from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.security import get_current_user
from app.features.workspaces.repository import WorkspaceRepository
from app.features.workspaces.service import WorkspaceService
from app.features.workspaces.schemas import (
    CreateWorkspaceRequest,
    UpdateWorkspaceRequest,
    InviteMemberRequest,
    UpdateMemberRoleRequest,
    WorkspaceResponse,
    MemberResponse,
)
from app.models.user import User

router = APIRouter(prefix="/workspaces", tags=["workspaces"])


def get_service(session: AsyncSession = Depends(get_session)) -> WorkspaceService:
    return WorkspaceService(repo=WorkspaceRepository(session))


@router.get("", response_model=list[WorkspaceResponse])
async def list_workspaces(
    current_user: User = Depends(get_current_user),
    service: WorkspaceService = Depends(get_service),
):
    workspaces = await service.list_for_user(current_user.id)
    return [WorkspaceResponse.model_validate(w) for w in workspaces]


@router.post("", response_model=WorkspaceResponse, status_code=status.HTTP_201_CREATED)
async def create_workspace(
    body: CreateWorkspaceRequest,
    current_user: User = Depends(get_current_user),
    service: WorkspaceService = Depends(get_service),
    session: AsyncSession = Depends(get_session),
):
    workspace = await service.create(body.to_dto(owner_id=current_user.id))
    await session.commit()
    return WorkspaceResponse.model_validate(workspace)


@router.get("/{workspace_id}", response_model=WorkspaceResponse)
async def get_workspace(
    workspace_id: UUID,
    current_user: User = Depends(get_current_user),
    service: WorkspaceService = Depends(get_service),
):
    workspace = await service.get_or_404(workspace_id, user_id=current_user.id)
    return WorkspaceResponse.model_validate(workspace)


@router.patch("/{workspace_id}", response_model=WorkspaceResponse)
async def update_workspace(
    workspace_id: UUID,
    body: UpdateWorkspaceRequest,
    current_user: User = Depends(get_current_user),
    service: WorkspaceService = Depends(get_service),
    session: AsyncSession = Depends(get_session),
):
    workspace = await service.update(workspace_id, body.to_dto(), actor_id=current_user.id)
    await session.commit()
    return WorkspaceResponse.model_validate(workspace)


@router.delete("/{workspace_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_workspace(
    workspace_id: UUID,
    current_user: User = Depends(get_current_user),
    service: WorkspaceService = Depends(get_service),
    session: AsyncSession = Depends(get_session),
):
    await service.delete(workspace_id, actor_id=current_user.id)
    await session.commit()


@router.get("/{workspace_id}/members", response_model=list[MemberResponse])
async def list_members(
    workspace_id: UUID,
    current_user: User = Depends(get_current_user),
    service: WorkspaceService = Depends(get_service),
):
    members = await service.list_members(workspace_id)
    return [MemberResponse.model_validate(m) for m in members]


@router.post("/{workspace_id}/members", response_model=MemberResponse, status_code=status.HTTP_201_CREATED)
async def invite_member(
    workspace_id: UUID,
    body: InviteMemberRequest,
    current_user: User = Depends(get_current_user),
    service: WorkspaceService = Depends(get_service),
    session: AsyncSession = Depends(get_session),
):
    member = await service.invite_member(body.to_dto(workspace_id, invited_by=current_user.id))
    await session.commit()
    return MemberResponse.model_validate(member)


@router.patch("/{workspace_id}/members/{user_id}", response_model=MemberResponse)
async def update_member_role(
    workspace_id: UUID,
    user_id: UUID,
    body: UpdateMemberRoleRequest,
    current_user: User = Depends(get_current_user),
    service: WorkspaceService = Depends(get_service),
    session: AsyncSession = Depends(get_session),
):
    member = await service.update_member_role(body.to_dto(workspace_id, user_id, updated_by=current_user.id))
    await session.commit()
    return MemberResponse.model_validate(member)


@router.delete("/{workspace_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    workspace_id: UUID,
    user_id: UUID,
    current_user: User = Depends(get_current_user),
    service: WorkspaceService = Depends(get_service),
    session: AsyncSession = Depends(get_session),
):
    await service.remove_member(workspace_id, user_id, actor_id=current_user.id)
    await session.commit()
