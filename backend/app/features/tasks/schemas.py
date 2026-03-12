from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.models.task import Priority


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
    parent_task_id: UUID | None = None


@dataclass(frozen=True)
class UpdateTaskDTO:
    title: str | None = None
    description: str | None = None
    priority: Priority | None = None
    status_id: UUID | None = None
    assignee_ids: tuple[UUID, ...] | None = None
    reviewer_id: UUID | None = None
    due_date: datetime | None = None


# --- Request Schemas ---

class CreateTaskRequest(BaseModel):
    title: str
    description: str | None = None
    priority: Priority = Priority.none
    assignee_ids: list[UUID] = []
    reviewer_id: UUID | None = None
    due_date: datetime | None = None
    status_id: UUID | None = None

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
            list_id=list_id,
            workspace_id=workspace_id,
            project_id=project_id,
            reporter_id=reporter_id,
            parent_task_id=parent_task_id,
        )


class UpdateTaskRequest(BaseModel):
    title: str | None = None
    description: str | None = None
    priority: Priority | None = None
    status_id: UUID | None = None
    assignee_ids: list[UUID] | None = None
    reviewer_id: UUID | None = None
    due_date: datetime | None = None

    def to_dto(self) -> UpdateTaskDTO:
        return UpdateTaskDTO(
            title=self.title,
            description=self.description,
            priority=self.priority,
            status_id=self.status_id,
            assignee_ids=tuple(self.assignee_ids) if self.assignee_ids is not None else None,
            reviewer_id=self.reviewer_id,
            due_date=self.due_date,
        )


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
    order_index: float
    depth: int
    subtask_count: int = 0

    model_config = {"from_attributes": True}
