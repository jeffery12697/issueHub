from uuid import UUID

from fastapi import HTTPException, status

from app.features.workspaces.repository import WorkspaceRepository
from app.features.workspaces.schemas import (
    CreateWorkspaceDTO,
    UpdateWorkspaceDTO,
    InviteMemberDTO,
    UpdateMemberRoleDTO,
)
from app.models.workspace import Workspace, WorkspaceMember, WorkspaceRole


class WorkspaceService:
    def __init__(self, repo: WorkspaceRepository):
        self.repo = repo

    async def create(self, dto: CreateWorkspaceDTO) -> Workspace:
        return await self.repo.create(dto)

    async def get_or_404(self, workspace_id: UUID) -> Workspace:
        workspace = await self.repo.get_by_id(workspace_id)
        if not workspace:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")
        return workspace

    async def list_for_user(self, user_id: UUID) -> list[Workspace]:
        return await self.repo.list_for_user(user_id)

    async def update(self, workspace_id: UUID, dto: UpdateWorkspaceDTO, actor_id: UUID) -> Workspace:
        workspace = await self.get_or_404(workspace_id)
        await self._require_role(workspace_id, actor_id, {WorkspaceRole.owner, WorkspaceRole.admin})
        return await self.repo.update(workspace, dto)

    async def delete(self, workspace_id: UUID, actor_id: UUID) -> None:
        workspace = await self.get_or_404(workspace_id)
        await self._require_role(workspace_id, actor_id, {WorkspaceRole.owner})
        await self.repo.soft_delete(workspace)

    async def list_members(self, workspace_id: UUID) -> list[WorkspaceMember]:
        await self.get_or_404(workspace_id)
        return await self.repo.list_members(workspace_id)

    async def invite_member(self, dto: InviteMemberDTO) -> WorkspaceMember:
        await self._require_role(dto.workspace_id, dto.invited_by, {WorkspaceRole.owner, WorkspaceRole.admin})
        existing = await self.repo.get_member(dto.workspace_id, dto.user_id)
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User is already a member")
        return await self.repo.add_member(dto)

    async def update_member_role(self, dto: UpdateMemberRoleDTO) -> WorkspaceMember:
        await self._require_role(dto.workspace_id, dto.updated_by, {WorkspaceRole.owner, WorkspaceRole.admin})
        member = await self.repo.get_member(dto.workspace_id, dto.user_id)
        if not member:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")
        return await self.repo.update_member_role(dto)

    async def remove_member(self, workspace_id: UUID, user_id: UUID, actor_id: UUID) -> None:
        await self._require_role(workspace_id, actor_id, {WorkspaceRole.owner, WorkspaceRole.admin})
        member = await self.repo.get_member(workspace_id, user_id)
        if not member:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")
        if member.role == WorkspaceRole.owner:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot remove the workspace owner")
        await self.repo.remove_member(workspace_id, user_id)

    async def _require_role(self, workspace_id: UUID, user_id: UUID, allowed: set[WorkspaceRole]) -> None:
        member = await self.repo.get_member(workspace_id, user_id)
        if not member or member.role not in allowed:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
