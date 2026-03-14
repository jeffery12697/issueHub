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
    task_prefix: str | None = None


@dataclass(frozen=True)
class UpdateProjectDTO:
    name: str | None
    description: str | None
    task_prefix: str | None = None


# --- Request Schemas ---

class CreateProjectRequest(BaseModel):
    name: str
    description: str | None = None
    task_prefix: str | None = None

    def to_dto(self, workspace_id: UUID, created_by: UUID) -> CreateProjectDTO:
        return CreateProjectDTO(
            workspace_id=workspace_id,
            name=self.name,
            description=self.description,
            created_by=created_by,
            task_prefix=self.task_prefix,
        )


class UpdateProjectRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    task_prefix: str | None = None

    def to_dto(self) -> UpdateProjectDTO:
        return UpdateProjectDTO(
            name=self.name,
            description=self.description,
            task_prefix=self.task_prefix,
        )


# --- Response Schemas ---

class ProjectResponse(BaseModel):
    id: UUID
    workspace_id: UUID
    name: str
    description: str | None
    task_prefix: str

    model_config = {"from_attributes": True}
