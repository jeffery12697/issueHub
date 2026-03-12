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


@dataclass(frozen=True)
class UpdateTemplateDTO:
    name: str | None
    default_statuses: list | None


class UpdateTemplateRequest(BaseModel):
    name: str | None = None
    default_statuses: list[dict[str, Any]] | None = None


class CreateListFromTemplateRequest(BaseModel):
    name: str
    template_id: UUID


class TemplateResponse(BaseModel):
    id: UUID
    workspace_id: UUID
    name: str
    default_statuses: list

    model_config = {"from_attributes": True}
