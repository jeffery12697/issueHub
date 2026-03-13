from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.team import Team, TeamMember, TeamRole
from app.models.user import User
from app.features.teams.schemas import CreateTeamDTO, AddTeamMemberDTO


class TeamRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, dto: CreateTeamDTO) -> Team:
        team = Team(
            workspace_id=dto.workspace_id,
            name=dto.name,
            created_by=dto.created_by,
        )
        self.session.add(team)
        await self.session.flush()
        return team

    async def get_by_id(self, team_id: UUID) -> Team | None:
        result = await self.session.execute(
            select(Team)
            .where(Team.id == team_id)
            .where(Team.deleted_at.is_(None))
        )
        return result.scalar_one_or_none()

    async def list_for_workspace(self, workspace_id: UUID) -> list[Team]:
        result = await self.session.execute(
            select(Team)
            .where(Team.workspace_id == workspace_id)
            .where(Team.deleted_at.is_(None))
            .order_by(Team.created_at)
        )
        return list(result.scalars().all())

    async def soft_delete(self, team: Team) -> None:
        team.soft_delete()
        await self.session.flush()

    async def add_member(self, dto: AddTeamMemberDTO) -> TeamMember:
        member = TeamMember(
            team_id=dto.team_id,
            user_id=dto.user_id,
            role=dto.role,
        )
        self.session.add(member)
        await self.session.flush()
        return member

    async def get_member(self, team_id: UUID, user_id: UUID) -> TeamMember | None:
        result = await self.session.execute(
            select(TeamMember)
            .where(TeamMember.team_id == team_id)
            .where(TeamMember.user_id == user_id)
            .where(TeamMember.deleted_at.is_(None))
        )
        return result.scalar_one_or_none()

    async def list_members(self, team_id: UUID) -> list[tuple[TeamMember, str]]:
        """Return list of (TeamMember, display_name) tuples."""
        result = await self.session.execute(
            select(TeamMember, User.display_name)
            .join(User, User.id == TeamMember.user_id)
            .where(TeamMember.team_id == team_id)
            .where(TeamMember.deleted_at.is_(None))
        )
        return list(result.all())

    async def remove_member(self, team_id: UUID, user_id: UUID) -> None:
        member = await self.get_member(team_id, user_id)
        if member:
            member.soft_delete()
            await self.session.flush()

    async def get_user_team_ids(self, workspace_id: UUID, user_id: UUID) -> list[UUID]:
        """Return list of team IDs the user is a member of in the workspace."""
        result = await self.session.execute(
            select(TeamMember.team_id)
            .join(Team, Team.id == TeamMember.team_id)
            .where(Team.workspace_id == workspace_id)
            .where(TeamMember.user_id == user_id)
            .where(TeamMember.deleted_at.is_(None))
            .where(Team.deleted_at.is_(None))
        )
        return list(result.scalars().all())
