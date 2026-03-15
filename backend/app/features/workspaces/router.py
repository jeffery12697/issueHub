from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.security import get_current_user
from app.core.email import send_email
from app.core.email_templates import invite_email
from app.core.config import settings
from app.features.workspaces.repository import WorkspaceRepository
from app.features.workspaces.service import WorkspaceService
from app.features.workspaces.schemas import (
    CreateWorkspaceRequest,
    UpdateWorkspaceRequest,
    InviteMemberRequest,
    UpdateMemberRoleRequest,
    SendInviteRequest,
    InviteResponse,
    WorkspaceResponse,
    MemberResponse,
    AnalyticsResponse,
    StatusCount,
    MemberWorkloadResponse,
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
    session: AsyncSession = Depends(get_session),
):
    from sqlalchemy import select
    from app.models.workspace import WorkspaceMember
    from app.models.user import User as UserModel
    result = await session.execute(
        select(UserModel.id, UserModel.display_name, WorkspaceMember.role)
        .join(WorkspaceMember, WorkspaceMember.user_id == UserModel.id)
        .where(WorkspaceMember.workspace_id == workspace_id)
    )
    return [
        MemberResponse(user_id=row.id, display_name=row.display_name, role=row.role)
        for row in result.all()
    ]


@router.post("/{workspace_id}/members", response_model=MemberResponse, status_code=status.HTTP_201_CREATED)
async def invite_member(
    workspace_id: UUID,
    body: InviteMemberRequest,
    current_user: User = Depends(get_current_user),
    service: WorkspaceService = Depends(get_service),
    session: AsyncSession = Depends(get_session),
):
    from sqlalchemy import select
    from app.models.user import User as UserModel
    member = await service.invite_member(body.to_dto(workspace_id, invited_by=current_user.id))
    await session.commit()
    user_row = await session.get(UserModel, member.user_id)
    return MemberResponse(user_id=member.user_id, display_name=user_row.display_name, role=member.role)


@router.patch("/{workspace_id}/members/{user_id}", response_model=MemberResponse)
async def update_member_role(
    workspace_id: UUID,
    user_id: UUID,
    body: UpdateMemberRoleRequest,
    current_user: User = Depends(get_current_user),
    service: WorkspaceService = Depends(get_service),
    session: AsyncSession = Depends(get_session),
):
    from sqlalchemy import select
    from app.models.user import User as UserModel
    member = await service.update_member_role(body.to_dto(workspace_id, user_id, updated_by=current_user.id))
    await session.commit()
    user_row = await session.get(UserModel, member.user_id)
    return MemberResponse(user_id=member.user_id, display_name=user_row.display_name, role=member.role)


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


@router.post("/{workspace_id}/invites", response_model=InviteResponse, status_code=status.HTTP_201_CREATED)
async def send_workspace_invite(
    workspace_id: UUID,
    body: SendInviteRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    repo = WorkspaceRepository(session)
    member = await repo.get_member(workspace_id, current_user.id)
    if not member or member.role not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Only owners and admins can send invites")

    workspace = await repo.get_by_id(workspace_id)
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    invite = await repo.create_invite(body.to_dto(workspace_id, invited_by=current_user.id))
    await session.commit()

    invite_url = f"{settings.frontend_url}/invites/{invite.token}"
    background_tasks.add_task(
        send_email,
        to=body.email,
        subject=f"You're invited to join {workspace.name} on IssueHub",
        html=invite_email(current_user.display_name, workspace.name, invite_url),
    )
    return InviteResponse.model_validate(invite)


@router.get("/invites/{token}", response_model=InviteResponse)
async def get_invite(
    token: str,
    session: AsyncSession = Depends(get_session),
):
    repo = WorkspaceRepository(session)
    invite = await repo.get_invite_by_token(token)
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    return InviteResponse.model_validate(invite)


@router.post("/invites/{token}/accept", status_code=status.HTTP_204_NO_CONTENT)
async def accept_invite(
    token: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    from datetime import datetime, timezone
    repo = WorkspaceRepository(session)
    invite = await repo.get_invite_by_token(token)
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    if invite.email != current_user.email:
        raise HTTPException(status_code=403, detail="This invite was sent to a different email address")
    if invite.accepted_at is not None:
        raise HTTPException(status_code=409, detail="Invite already accepted")
    if invite.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=410, detail="Invite has expired")

    # Add as workspace member if not already
    existing = await repo.get_member(invite.workspace_id, current_user.id)
    if not existing:
        from app.features.workspaces.schemas import InviteMemberDTO
        await repo.add_member(
            InviteMemberDTO(
                workspace_id=invite.workspace_id,
                user_id=current_user.id,
                role=invite.role,
                invited_by=invite.invited_by,
            )
        )
    await repo.accept_invite(invite)
    await session.commit()


@router.get("/{workspace_id}/analytics", response_model=AnalyticsResponse)
async def get_analytics(
    workspace_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    from app.features.tasks.repository import TaskRepository
    from app.features.lists.repository import ListRepository

    workspace_repo = WorkspaceRepository(session)
    member = await workspace_repo.get_member(workspace_id, current_user.id)
    if not member:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Not a workspace member")

    task_repo = TaskRepository(session)
    list_repo = ListRepository(session)

    data = await task_repo.analytics_for_workspace(workspace_id)

    # Resolve status names
    status_ids = [row["status_id"] for row in data["by_status"] if row["status_id"] is not None]
    status_name_map: dict = {}
    for sid in status_ids:
        s = await list_repo.get_status_by_id(sid)
        if s:
            status_name_map[str(sid)] = s.name

    tasks_by_status = [
        StatusCount(
            status_id=row["status_id"],
            status_name=status_name_map.get(str(row["status_id"])) if row["status_id"] else None,
            count=row["count"],
            story_points=row["story_points"],
        )
        for row in data["by_status"]
    ]

    return AnalyticsResponse(
        total_tasks=data["total"],
        overdue_tasks=data["overdue"],
        total_story_points=data["total_story_points"],
        tasks_by_status=tasks_by_status,
    )


@router.get("/{workspace_id}/workload", response_model=list[MemberWorkloadResponse])
async def get_workload(
    workspace_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    from sqlalchemy import select
    from app.models.workspace import WorkspaceMember
    from app.models.user import User as UserModel
    from app.features.tasks.repository import TaskRepository
    from app.features.tasks.schemas import TaskResponse

    workspace_repo = WorkspaceRepository(session)
    member = await workspace_repo.get_member(workspace_id, current_user.id)
    if not member:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Not a workspace member")

    # Get members with display names
    result = await session.execute(
        select(UserModel.id, UserModel.display_name)
        .join(WorkspaceMember, WorkspaceMember.user_id == UserModel.id)
        .where(WorkspaceMember.workspace_id == workspace_id)
    )
    members = result.all()

    task_repo = TaskRepository(session)
    workload = []
    for row in members:
        tasks = await task_repo.list_my_tasks(workspace_id, row.id)
        task_responses = [TaskResponse.model_validate(t) for t in tasks]
        workload.append(MemberWorkloadResponse(
            user_id=row.id,
            display_name=row.display_name,
            open_task_count=len(tasks),
            total_story_points=sum(t.story_points or 0 for t in task_responses),
            tasks=task_responses,
        ))
    return workload
