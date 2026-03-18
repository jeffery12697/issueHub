from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.models.epic import EpicStatus


# --- DTOs ---

@dataclass(frozen=True)
class CreateEpicDTO:
    name: str
    project_id: UUID
    workspace_id: UUID
    created_by: UUID
    description: str | None = None
    color: str | None = None
    status: EpicStatus = EpicStatus.not_started
    start_date: datetime | None = None
    due_date: datetime | None = None


@dataclass(frozen=True)
class UpdateEpicDTO:
    name: str | None = None
    description: str | None = None
    color: str | None = None
    status: EpicStatus | None = None
    start_date: datetime | None = None
    due_date: datetime | None = None


# --- Request Schemas ---

class CreateEpicRequest(BaseModel):
    name: str
    description: str | None = None
    color: str | None = None
    status: EpicStatus = EpicStatus.not_started
    start_date: datetime | None = None
    due_date: datetime | None = None

    def to_dto(self, project_id: UUID, workspace_id: UUID, created_by: UUID) -> CreateEpicDTO:
        return CreateEpicDTO(
            name=self.name,
            description=self.description,
            color=self.color,
            status=self.status,
            start_date=self.start_date,
            due_date=self.due_date,
            project_id=project_id,
            workspace_id=workspace_id,
            created_by=created_by,
        )


class UpdateEpicRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    color: str | None = None
    status: EpicStatus | None = None
    start_date: datetime | None = None
    due_date: datetime | None = None

    def to_dto(self) -> UpdateEpicDTO:
        return UpdateEpicDTO(
            name=self.name,
            description=self.description,
            color=self.color,
            status=self.status,
            start_date=self.start_date,
            due_date=self.due_date,
        )


# --- Response Schemas ---

class EpicResponse(BaseModel):
    id: UUID
    project_id: UUID
    workspace_id: UUID
    name: str
    description: str | None
    color: str | None
    status: EpicStatus
    start_date: datetime | None
    due_date: datetime | None
    order_index: float
    created_by: UUID
    task_count: int = 0
    done_count: int = 0

    model_config = {"from_attributes": True}
