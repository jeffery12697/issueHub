import enum
from dataclasses import dataclass
from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel


class FieldType(str, enum.Enum):
    text = "text"
    number = "number"
    date = "date"
    dropdown = "dropdown"
    checkbox = "checkbox"
    url = "url"


# --- DTOs ---

@dataclass(frozen=True)
class CreateFieldDTO:
    list_id: UUID
    name: str
    field_type: FieldType
    is_required: bool
    options_json: list | None
    order_index: float
    visibility_roles: tuple[str, ...] = ()
    editable_roles: tuple[str, ...] = ()


@dataclass(frozen=True)
class UpdateFieldDTO:
    name: str | None
    is_required: bool | None
    options_json: list | None
    visibility_roles: tuple[str, ...] | None = None
    editable_roles: tuple[str, ...] | None = None


@dataclass(frozen=True)
class UpsertFieldValueDTO:
    task_id: UUID
    field_id: UUID
    value_text: str | None
    value_number: float | None
    value_date: datetime | None
    value_boolean: bool | None
    value_json: dict | None


# --- Request Schemas ---

class CreateFieldRequest(BaseModel):
    name: str
    field_type: FieldType
    is_required: bool = False
    options_json: list | None = None
    visibility_roles: list[str] = []
    editable_roles: list[str] = []


class UpdateFieldRequest(BaseModel):
    name: str | None = None
    is_required: bool | None = None
    options_json: list | None = None
    visibility_roles: list[str] | None = None
    editable_roles: list[str] | None = None


class UpsertFieldValuesRequest(BaseModel):
    # map of field_id (str) -> value (any)
    values: dict[str, Any]


# --- Response Schemas ---

class FieldDefinitionResponse(BaseModel):
    id: UUID
    list_id: UUID
    name: str
    field_type: FieldType
    is_required: bool
    options_json: list | None
    order_index: float
    visibility_roles: list[str]
    editable_roles: list[str]

    model_config = {"from_attributes": True}


class FieldValueResponse(BaseModel):
    id: UUID
    task_id: UUID
    field_id: UUID
    value_text: str | None
    value_number: float | None
    value_date: datetime | None
    value_boolean: bool | None
    value_json: dict | None

    model_config = {"from_attributes": True}
