from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel


class SavedViewCreate(BaseModel):
    name: str
    filters_json: dict[str, Any]


class SavedViewResponse(BaseModel):
    id: UUID
    name: str
    filters_json: dict[str, Any]
    is_default: bool
    created_at: datetime

    model_config = {"from_attributes": True}
