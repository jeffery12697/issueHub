from uuid import UUID

from fastapi import HTTPException, status

from app.features.teams.repository import TeamRepository
from app.features.teams.schemas import CreateTeamDTO, AddTeamMemberDTO
from app.features.workspaces.repository import WorkspaceRepository
from app.models.team import Team, TeamMember, TeamRole
from app.models.workspace import WorkspaceRole


class TeamService:
    def __init__(
        self,
        repo: TeamRepository,
        workspace_repo: WorkspaceRepository,
    ):
        self.repo = repo
        self.workspace_repo = workspace_repo

    async def create(self, dto: CreateTeamDTO) -> Team:
        await self._require_workspace_role(
            dto.workspace_id, dto.created_by, {WorkspaceRole.owner, WorkspaceRole.admin}
        )
        return await self.repo.create(dto)

    async def get_or_404(self, team_id: UUID) -> Team:
        team = await self.repo.get_by_id(team_id)
        if not team:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")
        return team

    async def list_for_workspace(self, workspace_id: UUID, actor_id: UUID) -> list[Team]:
        await self._require_workspace_member(workspace_id, actor_id)
        return await self.repo.list_for_workspace(workspace_id)

    async def delete(self, workspace_id: UUID, team_id: UUID, actor_id: UUID) -> None:
        await self._require_workspace_role(
            workspace_id, actor_id, {WorkspaceRole.owner, WorkspaceRole.admin}
        )
        team = await self.get_or_404(team_id)
        if team.workspace_id != workspace_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")
        await self.repo.soft_delete(team)

    async def add_member(
        self,
        workspace_id: UUID,
        team_id: UUID,
        dto: AddTeamMemberDTO,
        actor_id: UUID,
    ) -> TeamMember:
        team = await self.get_or_404(team_id)
        if team.workspace_id != workspace_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")

        # Allow workspace owner/admin or team_admin
        ws_member = await self.workspace_repo.get_member(workspace_id, actor_id)
        if not ws_member:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a workspace member")

        if ws_member.role not in {WorkspaceRole.owner, WorkspaceRole.admin}:
            # Check if actor is a team_admin of this team
            team_membership = await self.repo.get_member(team_id, actor_id)
            if not team_membership or team_membership.role != TeamRole.team_admin:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

        # Ensure target user is a workspace member
        target_member = await self.workspace_repo.get_member(workspace_id, dto.user_id)
        if not target_member:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="User is not a member of this workspace",
            )

        existing = await self.repo.get_member(team_id, dto.user_id)
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User is already a team member")

        return await self.repo.add_member(dto)

    async def list_members(self, workspace_id: UUID, team_id: UUID, actor_id: UUID) -> list[dict]:
        await self._require_workspace_member(workspace_id, actor_id)
        team = await self.get_or_404(team_id)
        if team.workspace_id != workspace_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")
        rows = await self.repo.list_members(team_id)
        return [
            {
                "team_id": member.team_id,
                "user_id": member.user_id,
                "role": member.role,
                "display_name": display_name,
            }
            for member, display_name in rows
        ]

    async def remove_member(
        self,
        workspace_id: UUID,
        team_id: UUID,
        user_id: UUID,
        actor_id: UUID,
    ) -> None:
        team = await self.get_or_404(team_id)
        if team.workspace_id != workspace_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")

        ws_member = await self.workspace_repo.get_member(workspace_id, actor_id)
        if not ws_member:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a workspace member")

        if ws_member.role not in {WorkspaceRole.owner, WorkspaceRole.admin}:
            team_membership = await self.repo.get_member(team_id, actor_id)
            if not team_membership or team_membership.role != TeamRole.team_admin:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

        member = await self.repo.get_member(team_id, user_id)
        if not member:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")

        await self.repo.remove_member(team_id, user_id)

    async def _require_workspace_member(self, workspace_id: UUID, user_id: UUID) -> None:
        member = await self.workspace_repo.get_member(workspace_id, user_id)
        if not member:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a workspace member")

    async def _require_workspace_role(
        self, workspace_id: UUID, user_id: UUID, allowed: set[WorkspaceRole]
    ) -> None:
        member = await self.workspace_repo.get_member(workspace_id, user_id)
        if not member or member.role not in allowed:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
