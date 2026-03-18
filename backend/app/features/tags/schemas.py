from dataclasses import dataclass
from uuid import UUID

from pydantic import BaseModel


# --- DTOs ---

@dataclass(frozen=True)
class CreateTagDTO:
    workspace_id: UUID
    name: str
    color: str


@dataclass(frozen=True)
class UpdateTagDTO:
    name: str | None
    color: str | None


# --- Request Schemas ---

class CreateTagRequest(BaseModel):
    name: str
    color: str = "#6B7280"


class UpdateTagRequest(BaseModel):
    name: str | None = None
    color: str | None = None


class AddTagToTaskRequest(BaseModel):
    tag_id: UUID


# --- Response Schemas ---

class TagResponse(BaseModel):
    id: UUID
    workspace_id: UUID
    name: str
    color: str

    model_config = {"from_attributes": True}
