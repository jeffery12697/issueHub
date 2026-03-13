from dataclasses import dataclass
from uuid import UUID

from pydantic import BaseModel

from app.models.team import TeamRole


# --- DTOs ---

@dataclass(frozen=True)
class CreateTeamDTO:
    workspace_id: UUID
    name: str
    created_by: UUID


@dataclass(frozen=True)
class AddTeamMemberDTO:
    team_id: UUID
    user_id: UUID
    role: TeamRole


# --- Request Schemas ---

class CreateTeamRequest(BaseModel):
    name: str

    def to_dto(self, workspace_id: UUID, created_by: UUID) -> CreateTeamDTO:
        return CreateTeamDTO(
            workspace_id=workspace_id,
            name=self.name,
            created_by=created_by,
        )


class AddTeamMemberRequest(BaseModel):
    user_id: UUID
    role: TeamRole = TeamRole.team_member

    def to_dto(self, team_id: UUID) -> AddTeamMemberDTO:
        return AddTeamMemberDTO(
            team_id=team_id,
            user_id=self.user_id,
            role=self.role,
        )


# --- Response Schemas ---

class TeamResponse(BaseModel):
    id: UUID
    workspace_id: UUID
    name: str
    created_by: UUID

    model_config = {"from_attributes": True}


class TeamMemberResponse(BaseModel):
    team_id: UUID
    user_id: UUID
    role: TeamRole
    display_name: str

    model_config = {"from_attributes": True}
