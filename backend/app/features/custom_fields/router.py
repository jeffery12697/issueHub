from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.security import get_current_user
from app.features.custom_fields.repository import CustomFieldRepository
from app.features.custom_fields.schemas import (
    CreateFieldRequest,
    FieldDefinitionResponse,
    FieldValueResponse,
    UpdateFieldRequest,
    UpsertFieldValuesRequest,
)
from app.features.custom_fields.service import CustomFieldService
from app.features.lists.repository import ListRepository
from app.features.projects.repository import ProjectRepository
from app.features.tasks.repository import TaskRepository
from app.features.workspaces.repository import WorkspaceRepository
from app.models.user import User

router = APIRouter(tags=["custom_fields"])


def get_service(session: AsyncSession = Depends(get_session)) -> CustomFieldService:
    return CustomFieldService(
        repo=CustomFieldRepository(session),
        list_repo=ListRepository(session),
        project_repo=ProjectRepository(session),
        task_repo=TaskRepository(session),
        workspace_repo=WorkspaceRepository(session),
    )


@router.get(
    "/lists/{list_id}/custom-fields",
    response_model=list[FieldDefinitionResponse],
)
async def list_fields(
    list_id: UUID,
    current_user: User = Depends(get_current_user),
    service: CustomFieldService = Depends(get_service),
):
    fields = await service.list_fields(list_id, user_id=current_user.id)
    return [FieldDefinitionResponse.model_validate(f) for f in fields]


@router.post(
    "/lists/{list_id}/custom-fields",
    response_model=FieldDefinitionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_field(
    list_id: UUID,
    body: CreateFieldRequest,
    current_user: User = Depends(get_current_user),
    service: CustomFieldService = Depends(get_service),
    session: AsyncSession = Depends(get_session),
):
    from app.features.custom_fields.schemas import CreateFieldDTO
    dto = CreateFieldDTO(
        list_id=list_id,
        name=body.name,
        field_type=body.field_type,
        is_required=body.is_required,
        options_json=body.options_json,
        order_index=0.0,  # service will compute actual value
    )
    field = await service.create_field(list_id, dto, actor_id=current_user.id)
    await session.commit()
    return FieldDefinitionResponse.model_validate(field)


@router.patch(
    "/lists/{list_id}/custom-fields/{field_id}",
    response_model=FieldDefinitionResponse,
)
async def update_field(
    list_id: UUID,
    field_id: UUID,
    body: UpdateFieldRequest,
    current_user: User = Depends(get_current_user),
    service: CustomFieldService = Depends(get_service),
    session: AsyncSession = Depends(get_session),
):
    from app.features.custom_fields.schemas import UpdateFieldDTO
    dto = UpdateFieldDTO(
        name=body.name,
        is_required=body.is_required,
        options_json=body.options_json,
    )
    field = await service.update_field(list_id, field_id, dto, actor_id=current_user.id)
    await session.commit()
    return FieldDefinitionResponse.model_validate(field)


@router.delete(
    "/lists/{list_id}/custom-fields/{field_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_field(
    list_id: UUID,
    field_id: UUID,
    current_user: User = Depends(get_current_user),
    service: CustomFieldService = Depends(get_service),
    session: AsyncSession = Depends(get_session),
):
    await service.delete_field(list_id, field_id, actor_id=current_user.id)
    await session.commit()


@router.get(
    "/tasks/{task_id}/field-values",
    response_model=list[FieldValueResponse],
)
async def get_task_field_values(
    task_id: UUID,
    current_user: User = Depends(get_current_user),
    service: CustomFieldService = Depends(get_service),
):
    values = await service.get_task_values(task_id, user_id=current_user.id)
    return [FieldValueResponse.model_validate(v) for v in values]


@router.put(
    "/tasks/{task_id}/field-values",
    response_model=list[FieldValueResponse],
)
async def upsert_task_field_values(
    task_id: UUID,
    body: UpsertFieldValuesRequest,
    current_user: User = Depends(get_current_user),
    service: CustomFieldService = Depends(get_service),
    session: AsyncSession = Depends(get_session),
):
    values = await service.upsert_task_values(task_id, body.values, actor_id=current_user.id)
    await session.commit()
    return [FieldValueResponse.model_validate(v) for v in values]
