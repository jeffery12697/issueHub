from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, field_validator

from app.models.automation import ActionType, TriggerType


class CreateAutomationRequest(BaseModel):
    trigger_type: TriggerType
    trigger_value: str
    action_type: ActionType
    action_value: str | None = None

    @field_validator("action_value")
    @classmethod
    def validate_action_value(cls, v: str | None, info) -> str | None:
        action_type = info.data.get("action_type")
        if action_type == ActionType.clear_assignees:
            return None
        if v is None:
            raise ValueError(f"action_value is required for action_type '{action_type}'")
        return v


class AutomationResponse(BaseModel):
    id: UUID
    list_id: UUID
    trigger_type: TriggerType
    trigger_value: str
    action_type: ActionType
    action_value: str | None
    created_by: UUID
    created_at: datetime

    model_config = {"from_attributes": True}
