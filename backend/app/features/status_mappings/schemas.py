from uuid import UUID
from pydantic import BaseModel


class StatusMappingUpsert(BaseModel):
    from_list_id: UUID
    from_status_id: UUID
    to_list_id: UUID
    to_status_id: UUID


class StatusMappingResponse(BaseModel):
    id: UUID
    project_id: UUID
    from_list_id: UUID
    from_status_id: UUID
    to_list_id: UUID
    to_status_id: UUID

    model_config = {"from_attributes": True}
