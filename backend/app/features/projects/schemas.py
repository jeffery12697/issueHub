from dataclasses import dataclass
from uuid import UUID

from pydantic import BaseModel


# --- DTOs ---

@dataclass(frozen=True)
class CreateProjectDTO:
    workspace_id: UUID
    name: str
    description: str | None
    created_by: UUID


@dataclass(frozen=True)
class UpdateProjectDTO:
    name: str
    description: str | None


# --- Request Schemas ---

class CreateProjectRequest(BaseModel):
    name: str
    description: str | None = None

    def to_dto(self, workspace_id: UUID, created_by: UUID) -> CreateProjectDTO:
        return CreateProjectDTO(
            workspace_id=workspace_id,
            name=self.name,
            description=self.description,
            created_by=created_by,
        )


class UpdateProjectRequest(BaseModel):
    name: str | None = None
    description: str | None = None

    def to_dto(self) -> UpdateProjectDTO:
        return UpdateProjectDTO(name=self.name, description=self.description)


# --- Response Schemas ---

class ProjectResponse(BaseModel):
    id: UUID
    workspace_id: UUID
    name: str
    description: str | None

    model_config = {"from_attributes": True}
