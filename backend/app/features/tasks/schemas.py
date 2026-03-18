from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, model_validator

from app.models.task import Priority


_UNSET = object()  # sentinel: field not provided in update request


# --- DTOs ---

@dataclass(frozen=True)
class CreateTaskDTO:
    title: str
    list_id: UUID
    workspace_id: UUID
    project_id: UUID
    reporter_id: UUID
    priority: Priority = Priority.none
    description: str | None = None
    assignee_ids: tuple[UUID, ...] = ()
    reviewer_id: UUID | None = None
    due_date: datetime | None = None
    start_date: datetime | None = None
    story_points: int | None = None
    parent_task_id: UUID | None = None
    epic_id: UUID | None = None


@dataclass(frozen=True)
class UpdateTaskDTO:
    title: str | None = None
    description: str | None = None
    priority: Priority | None = None
    status_id: UUID | None = None
    assignee_ids: tuple[UUID, ...] | None = None
    reviewer_id: object = None  # _UNSET=not provided, None=clear, UUID=set; default _UNSET
    due_date: datetime | None = None
    start_date: datetime | None = None
    story_points: int | None = None
    epic_id: object = None  # _UNSET=not provided, None=clear, UUID=set

    def __post_init__(self):
        # Can't set default to _UNSET in frozen dataclass easily; caller must pass _UNSET explicitly
        pass


# --- Request Schemas ---

class CreateTaskRequest(BaseModel):
    title: str
    description: str | None = None
    priority: Priority = Priority.none
    assignee_ids: list[UUID] = []
    reviewer_id: UUID | None = None
    due_date: datetime | None = None
    start_date: datetime | None = None
    story_points: int | None = None
    status_id: UUID | None = None
    list_id: UUID | None = None  # optional override for subtask list assignment
    epic_id: UUID | None = None

    def to_dto(
        self,
        list_id: UUID,
        workspace_id: UUID,
        project_id: UUID,
        reporter_id: UUID,
        parent_task_id: UUID | None = None,
    ) -> CreateTaskDTO:
        return CreateTaskDTO(
            title=self.title,
            description=self.description,
            priority=self.priority,
            assignee_ids=tuple(self.assignee_ids),
            reviewer_id=self.reviewer_id,
            due_date=self.due_date,
            start_date=self.start_date,
            story_points=self.story_points,
            list_id=list_id,
            workspace_id=workspace_id,
            project_id=project_id,
            reporter_id=reporter_id,
            parent_task_id=parent_task_id,
            epic_id=self.epic_id,
        )


class UpdateTaskRequest(BaseModel):
    title: str | None = None
    description: str | None = None
    priority: Priority | None = None
    status_id: UUID | None = None
    assignee_ids: list[UUID] | None = None
    reviewer_id: UUID | None = None
    due_date: datetime | None = None
    start_date: datetime | None = None
    story_points: int | None = None
    epic_id: UUID | None = None

    def to_dto(self) -> "UpdateTaskDTO":
        return UpdateTaskDTO(
            title=self.title,
            description=self.description,
            priority=self.priority,
            status_id=self.status_id,
            assignee_ids=tuple(self.assignee_ids) if self.assignee_ids is not None else None,
            reviewer_id=self.reviewer_id if 'reviewer_id' in self.model_fields_set else _UNSET,
            due_date=self.due_date,
            start_date=self.start_date,
            story_points=self.story_points,
            epic_id=self.epic_id if 'epic_id' in self.model_fields_set else _UNSET,
        )


# --- Bulk Operation Schemas ---

class MoveTaskRequest(BaseModel):
    list_id: UUID


class BulkUpdateRequest(BaseModel):
    task_ids: list[UUID]
    status_id: UUID | None = None
    priority: Priority | None = None
    epic_id: UUID | None = None

    @model_validator(mode='after')
    def at_least_one_field(self) -> 'BulkUpdateRequest':
        has_epic = 'epic_id' in self.model_fields_set
        if self.status_id is None and self.priority is None and not has_epic:
            raise ValueError("At least one of status_id, priority, or epic_id must be set")
        return self


class BulkDeleteRequest(BaseModel):
    task_ids: list[UUID]


class BulkMoveRequest(BaseModel):
    task_ids: list[UUID]
    list_id: UUID


class BulkOperationResponse(BaseModel):
    updated: int


# --- Response Schemas ---

class TaskResponse(BaseModel):
    id: UUID
    workspace_id: UUID
    project_id: UUID
    list_id: UUID | None
    parent_task_id: UUID | None
    status_id: UUID | None
    reporter_id: UUID
    reviewer_id: UUID | None
    title: str
    description: str | None
    priority: Priority
    assignee_ids: list[UUID]
    due_date: datetime | None
    start_date: datetime | None
    story_points: int | None
    order_index: float
    depth: int
    subtask_count: int = 0
    task_number: int | None = None
    task_key: str | None = None
    epic_id: UUID | None = None
    tag_ids: list[UUID] = []

    model_config = {"from_attributes": True}


class TaskSearchResult(TaskResponse):
    list_name: str | None = None
    project_name: str | None = None
