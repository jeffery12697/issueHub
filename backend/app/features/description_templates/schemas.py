from dataclasses import dataclass
from uuid import UUID

from pydantic import BaseModel


@dataclass(frozen=True)
class CreateDescriptionTemplateDTO:
    workspace_id: UUID
    name: str
    content: str
    created_by: UUID


@dataclass(frozen=True)
class UpdateDescriptionTemplateDTO:
    name: str | None
    content: str | None


class CreateDescriptionTemplateRequest(BaseModel):
    name: str
    content: str = ""


class UpdateDescriptionTemplateRequest(BaseModel):
    name: str | None = None
    content: str | None = None


class DescriptionTemplateResponse(BaseModel):
    id: UUID
    workspace_id: UUID
    name: str
    content: str

    model_config = {"from_attributes": True}
