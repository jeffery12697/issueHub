from dataclasses import dataclass
from uuid import UUID

from pydantic import BaseModel

from app.models.workspace import WorkspaceRole


# --- DTOs ---

@dataclass(frozen=True)
class CreateWorkspaceDTO:
    name: str
    owner_id: UUID


@dataclass(frozen=True)
class UpdateWorkspaceDTO:
    name: str


@dataclass(frozen=True)
class InviteMemberDTO:
    workspace_id: UUID
    user_id: UUID
    role: WorkspaceRole
    invited_by: UUID


@dataclass(frozen=True)
class UpdateMemberRoleDTO:
    workspace_id: UUID
    user_id: UUID
    role: WorkspaceRole
    updated_by: UUID


# --- Request Schemas ---

class CreateWorkspaceRequest(BaseModel):
    name: str

    def to_dto(self, owner_id: UUID) -> CreateWorkspaceDTO:
        return CreateWorkspaceDTO(name=self.name, owner_id=owner_id)


class UpdateWorkspaceRequest(BaseModel):
    name: str

    def to_dto(self) -> UpdateWorkspaceDTO:
        return UpdateWorkspaceDTO(name=self.name)


class InviteMemberRequest(BaseModel):
    user_id: UUID
    role: WorkspaceRole = WorkspaceRole.member

    def to_dto(self, workspace_id: UUID, invited_by: UUID) -> InviteMemberDTO:
        return InviteMemberDTO(
            workspace_id=workspace_id,
            user_id=self.user_id,
            role=self.role,
            invited_by=invited_by,
        )


class UpdateMemberRoleRequest(BaseModel):
    role: WorkspaceRole

    def to_dto(self, workspace_id: UUID, user_id: UUID, updated_by: UUID) -> UpdateMemberRoleDTO:
        return UpdateMemberRoleDTO(
            workspace_id=workspace_id,
            user_id=user_id,
            role=self.role,
            updated_by=updated_by,
        )


# --- Response Schemas ---

class WorkspaceResponse(BaseModel):
    id: UUID
    name: str

    model_config = {"from_attributes": True}


class MemberResponse(BaseModel):
    user_id: UUID
    role: WorkspaceRole

    model_config = {"from_attributes": True}
