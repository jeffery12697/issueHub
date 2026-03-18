from dataclasses import dataclass
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.models.dashboard_widget import WidgetType


class WidgetConfig(BaseModel):
    project_id: UUID | None = None


class CreateWidgetRequest(BaseModel):
    widget_type: WidgetType
    config: WidgetConfig = WidgetConfig()
    order_index: int = 0
    visible_to_members: bool = False

    def to_dto(self, workspace_id: UUID) -> "CreateWidgetDTO":
        return CreateWidgetDTO(
            workspace_id=workspace_id,
            widget_type=self.widget_type,
            config=self.config.model_dump(),
            order_index=self.order_index,
            visible_to_members=self.visible_to_members,
        )


class UpdateWidgetRequest(BaseModel):
    config: WidgetConfig | None = None
    visible_to_members: bool | None = None
    order_index: int | None = None


class ReorderRequest(BaseModel):
    widget_ids: list[UUID]


class WidgetResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    workspace_id: UUID
    widget_type: WidgetType
    config: dict
    order_index: int
    visible_to_members: bool


@dataclass(frozen=True)
class CreateWidgetDTO:
    workspace_id: UUID
    widget_type: WidgetType
    config: dict
    order_index: int
    visible_to_members: bool
