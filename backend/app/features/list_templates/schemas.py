from dataclasses import dataclass
from typing import Any
from uuid import UUID

from pydantic import BaseModel


@dataclass(frozen=True)
class CreateTemplateDTO:
    workspace_id: UUID
    name: str
    default_statuses: list
    default_custom_fields: list


@dataclass(frozen=True)
class CreateListFromTemplateDTO:
    project_id: UUID
    name: str
    template_id: UUID
    created_by: UUID


class CreateTemplateRequest(BaseModel):
    name: str
    default_statuses: list[dict[str, Any]] = []
    default_custom_fields: list[dict] = []


@dataclass(frozen=True)
class UpdateTemplateDTO:
    name: str | None
    default_statuses: list | None
    default_custom_fields: list | None


class UpdateTemplateRequest(BaseModel):
    name: str | None = None
    default_statuses: list[dict[str, Any]] | None = None
    default_custom_fields: list[dict] | None = None


class CreateListFromTemplateRequest(BaseModel):
    name: str
    template_id: UUID


class TemplateResponse(BaseModel):
    id: UUID
    workspace_id: UUID
    name: str
    default_statuses: list
    default_custom_fields: list

    model_config = {"from_attributes": True}
