from datetime import datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.models.workspace import Workspace, WorkspaceMember, WorkspaceInvite, WorkspaceRole
from app.features.workspaces.schemas import (
    CreateWorkspaceDTO,
    UpdateWorkspaceDTO,
    InviteMemberDTO,
    UpdateMemberRoleDTO,
    CreateInviteDTO,
)


class WorkspaceRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, dto: CreateWorkspaceDTO) -> Workspace:
        workspace = Workspace(name=dto.name)
        self.session.add(workspace)
        await self.session.flush()

        member = WorkspaceMember(
            workspace_id=workspace.id,
            user_id=dto.owner_id,
            role=WorkspaceRole.owner,
        )
        self.session.add(member)
        await self.session.flush()
        return workspace

    async def get_by_id(self, workspace_id: UUID) -> Workspace | None:
        result = await self.session.execute(
            select(Workspace)
            .where(Workspace.id == workspace_id)
            .where(Workspace.deleted_at.is_(None))
        )
        return result.scalar_one_or_none()

    async def list_for_user(self, user_id: UUID) -> list[Workspace]:
        result = await self.session.execute(
            select(Workspace)
            .join(WorkspaceMember, WorkspaceMember.workspace_id == Workspace.id)
            .where(WorkspaceMember.user_id == user_id)
            .where(Workspace.deleted_at.is_(None))
            .order_by(Workspace.created_at)
        )
        return list(result.scalars().all())

    async def update(self, workspace: Workspace, dto: UpdateWorkspaceDTO) -> Workspace:
        workspace.name = dto.name
        await self.session.flush()
        return workspace

    async def soft_delete(self, workspace: Workspace) -> None:
        workspace.soft_delete()
        await self.session.flush()

    async def get_member(self, workspace_id: UUID, user_id: UUID) -> WorkspaceMember | None:
        result = await self.session.execute(
            select(WorkspaceMember)
            .where(WorkspaceMember.workspace_id == workspace_id)
            .where(WorkspaceMember.user_id == user_id)
        )
        return result.scalar_one_or_none()

    async def list_members(self, workspace_id: UUID) -> list[WorkspaceMember]:
        result = await self.session.execute(
            select(WorkspaceMember)
            .where(WorkspaceMember.workspace_id == workspace_id)
        )
        return list(result.scalars().all())

    async def add_member(self, dto: InviteMemberDTO) -> WorkspaceMember:
        member = WorkspaceMember(
            workspace_id=dto.workspace_id,
            user_id=dto.user_id,
            role=dto.role,
        )
        self.session.add(member)
        await self.session.flush()
        return member

    async def update_member_role(self, dto: UpdateMemberRoleDTO) -> WorkspaceMember:
        member = await self.get_member(dto.workspace_id, dto.user_id)
        member.role = dto.role
        await self.session.flush()
        return member

    async def remove_member(self, workspace_id: UUID, user_id: UUID) -> None:
        member = await self.get_member(workspace_id, user_id)
        if member:
            await self.session.delete(member)
            await self.session.flush()

    async def get_user_by_id(self, user_id: UUID) -> User | None:
        result = await self.session.execute(
            select(User).where(User.id == user_id).where(User.deleted_at.is_(None))
        )
        return result.scalar_one_or_none()

    async def create_invite(self, dto: CreateInviteDTO) -> WorkspaceInvite:
        invite = WorkspaceInvite(
            workspace_id=dto.workspace_id,
            email=dto.email,
            role=dto.role,
            token=WorkspaceInvite.make_token(),
            invited_by=dto.invited_by,
            expires_at=WorkspaceInvite.make_expires_at(),
        )
        self.session.add(invite)
        await self.session.flush()
        return invite

    async def get_invite_by_token(self, token: str) -> WorkspaceInvite | None:
        result = await self.session.execute(
            select(WorkspaceInvite).where(WorkspaceInvite.token == token)
        )
        return result.scalar_one_or_none()

    async def accept_invite(self, invite: WorkspaceInvite) -> None:
        invite.accepted_at = datetime.utcnow()
        await self.session.flush()

    async def list_member_users(self, workspace_id: UUID) -> list[User]:
        result = await self.session.execute(
            select(User)
            .join(WorkspaceMember, WorkspaceMember.user_id == User.id)
            .where(WorkspaceMember.workspace_id == workspace_id)
            .where(User.deleted_at.is_(None))
        )
        return list(result.scalars().all())
