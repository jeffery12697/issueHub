from dataclasses import dataclass
from typing import Any
from uuid import UUID

from pydantic import BaseModel


@dataclass(frozen=True)
class CreateTemplateDTO:
    workspace_id: UUID
    name: str
    default_statuses: list


@dataclass(frozen=True)
class CreateListFromTemplateDTO:
    project_id: UUID
    name: str
    template_id: UUID
    created_by: UUID


class CreateTemplateRequest(BaseModel):
    name: str
    default_statuses: list[dict[str, Any]] = []


class CreateListFromTemplateRequest(BaseModel):
    name: str
    template_id: UUID


class TemplateResponse(BaseModel):
    id: UUID
    workspace_id: UUID
    name: str
    default_statuses: list

    model_config = {"from_attributes": True}
