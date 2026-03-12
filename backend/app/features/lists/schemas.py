from dataclasses import dataclass
from uuid import UUID

from pydantic import BaseModel, field_validator

from app.models.list_status import StatusCategory


# --- DTOs ---

@dataclass(frozen=True)
class CreateListDTO:
    project_id: UUID
    name: str
    description: str | None
    created_by: UUID


@dataclass(frozen=True)
class UpdateListDTO:
    name: str | None
    description: str | None


@dataclass(frozen=True)
class CreateStatusDTO:
    list_id: UUID
    name: str
    color: str
    category: StatusCategory
    order_index: float


@dataclass(frozen=True)
class UpdateStatusDTO:
    name: str | None
    color: str | None
    is_complete: bool | None
    category: StatusCategory | None


@dataclass(frozen=True)
class ReorderStatusDTO:
    status_id: UUID
    before_id: UUID | None  # None = move to end
    after_id: UUID | None   # None = move to beginning


# --- Request Schemas ---

class CreateListRequest(BaseModel):
    name: str
    description: str | None = None

    def to_dto(self, project_id: UUID, created_by: UUID) -> CreateListDTO:
        return CreateListDTO(
            project_id=project_id,
            name=self.name,
            description=self.description,
            created_by=created_by,
        )


class UpdateListRequest(BaseModel):
    name: str | None = None
    description: str | None = None

    def to_dto(self) -> UpdateListDTO:
        return UpdateListDTO(name=self.name, description=self.description)


class CreateStatusRequest(BaseModel):
    name: str
    color: str = "#6b7280"
    category: StatusCategory = StatusCategory.not_started

    @field_validator("color")
    @classmethod
    def valid_hex(cls, v: str) -> str:
        if not (v.startswith("#") and len(v) == 7):
            raise ValueError("color must be a hex string like #3b82f6")
        return v

    def to_dto(self, list_id: UUID, order_index: float) -> CreateStatusDTO:
        return CreateStatusDTO(
            list_id=list_id,
            name=self.name,
            color=self.color,
            category=self.category,
            order_index=order_index,
        )


class UpdateStatusRequest(BaseModel):
    name: str | None = None
    color: str | None = None
    is_complete: bool | None = None
    category: StatusCategory | None = None

    @field_validator("color")
    @classmethod
    def valid_hex(cls, v: str | None) -> str | None:
        if v and not (v.startswith("#") and len(v) == 7):
            raise ValueError("color must be a hex string like #3b82f6")
        return v

    def to_dto(self) -> UpdateStatusDTO:
        return UpdateStatusDTO(
            name=self.name,
            color=self.color,
            is_complete=self.is_complete,
            category=self.category,
        )


class ReorderStatusRequest(BaseModel):
    before_id: UUID | None = None
    after_id: UUID | None = None

    def to_dto(self, status_id: UUID) -> ReorderStatusDTO:
        return ReorderStatusDTO(
            status_id=status_id,
            before_id=self.before_id,
            after_id=self.after_id,
        )


# --- Response Schemas ---

class ListStatusResponse(BaseModel):
    id: UUID
    list_id: UUID
    name: str
    color: str
    order_index: float
    is_complete: bool
    category: StatusCategory

    model_config = {"from_attributes": True}


class ListResponse(BaseModel):
    id: UUID
    project_id: UUID
    name: str
    description: str | None

    model_config = {"from_attributes": True}


class ListWithStatusesResponse(ListResponse):
    statuses: list[ListStatusResponse] = []
