from dataclasses import dataclass
from uuid import UUID
from pydantic import BaseModel


@dataclass(frozen=True)
class CreateLinkDTO:
    task_id: UUID
    created_by: UUID
    url: str
    title: str | None


class CreateLinkRequest(BaseModel):
    url: str
    title: str | None = None


class LinkResponse(BaseModel):
    id: UUID
    task_id: UUID
    created_by: UUID
    url: str
    title: str | None

    model_config = {"from_attributes": True}
