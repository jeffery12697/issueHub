from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.security import get_current_user
from app.features.teams.repository import TeamRepository
from app.features.teams.service import TeamService
from app.features.teams.schemas import (
    CreateTeamRequest,
    AddTeamMemberRequest,
    TeamResponse,
    TeamMemberResponse,
)
from app.features.workspaces.repository import WorkspaceRepository
from app.models.user import User

router = APIRouter(prefix="/workspaces", tags=["teams"])


def get_service(session: AsyncSession = Depends(get_session)) -> TeamService:
    return TeamService(
        repo=TeamRepository(session),
        workspace_repo=WorkspaceRepository(session),
    )


@router.post("/{workspace_id}/teams", response_model=TeamResponse, status_code=status.HTTP_201_CREATED)
async def create_team(
    workspace_id: UUID,
    body: CreateTeamRequest,
    current_user: User = Depends(get_current_user),
    service: TeamService = Depends(get_service),
    session: AsyncSession = Depends(get_session),
):
    team = await service.create(body.to_dto(workspace_id=workspace_id, created_by=current_user.id))
    await session.commit()
    return TeamResponse.model_validate(team)


@router.get("/{workspace_id}/teams", response_model=list[TeamResponse])
async def list_teams(
    workspace_id: UUID,
    current_user: User = Depends(get_current_user),
    service: TeamService = Depends(get_service),
):
    teams = await service.list_for_workspace(workspace_id, actor_id=current_user.id)
    return [TeamResponse.model_validate(t) for t in teams]


@router.delete("/{workspace_id}/teams/{team_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_team(
    workspace_id: UUID,
    team_id: UUID,
    current_user: User = Depends(get_current_user),
    service: TeamService = Depends(get_service),
    session: AsyncSession = Depends(get_session),
):
    await service.delete(workspace_id, team_id, actor_id=current_user.id)
    await session.commit()


@router.post(
    "/{workspace_id}/teams/{team_id}/members",
    response_model=TeamMemberResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_member(
    workspace_id: UUID,
    team_id: UUID,
    body: AddTeamMemberRequest,
    current_user: User = Depends(get_current_user),
    service: TeamService = Depends(get_service),
    session: AsyncSession = Depends(get_session),
):
    member = await service.add_member(
        workspace_id=workspace_id,
        team_id=team_id,
        dto=body.to_dto(team_id=team_id),
        actor_id=current_user.id,
    )
    await session.commit()
    # Fetch display_name for response
    from sqlalchemy import select
    from app.models.user import User as UserModel
    user_row = await session.get(UserModel, member.user_id)
    return TeamMemberResponse(
        team_id=member.team_id,
        user_id=member.user_id,
        role=member.role,
        display_name=user_row.display_name,
    )


@router.get("/{workspace_id}/teams/{team_id}/members", response_model=list[TeamMemberResponse])
async def list_members(
    workspace_id: UUID,
    team_id: UUID,
    current_user: User = Depends(get_current_user),
    service: TeamService = Depends(get_service),
):
    members = await service.list_members(workspace_id, team_id, actor_id=current_user.id)
    return [TeamMemberResponse(**m) for m in members]


@router.delete(
    "/{workspace_id}/teams/{team_id}/members/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def remove_member(
    workspace_id: UUID,
    team_id: UUID,
    user_id: UUID,
    current_user: User = Depends(get_current_user),
    service: TeamService = Depends(get_service),
    session: AsyncSession = Depends(get_session),
):
    await service.remove_member(workspace_id, team_id, user_id, actor_id=current_user.id)
    await session.commit()
