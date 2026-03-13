from datetime import datetime
from typing import Any
from uuid import UUID

from fastapi import HTTPException, status

from app.features.custom_fields.repository import CustomFieldRepository
from app.features.custom_fields.schemas import (
    CreateFieldDTO,
    FieldType,
    UpdateFieldDTO,
    UpsertFieldValueDTO,
)
from app.features.lists.repository import ListRepository
from app.features.projects.repository import ProjectRepository
from app.features.tasks.repository import TaskRepository
from app.features.workspaces.repository import WorkspaceRepository
from app.models.custom_field import CustomFieldDefinition, CustomFieldValue


class CustomFieldService:
    def __init__(
        self,
        repo: CustomFieldRepository,
        list_repo: ListRepository,
        project_repo: ProjectRepository,
        task_repo: TaskRepository,
        workspace_repo: WorkspaceRepository,
    ):
        self.repo = repo
        self.list_repo = list_repo
        self.project_repo = project_repo
        self.task_repo = task_repo
        self.workspace_repo = workspace_repo

    async def list_fields(self, list_id: UUID, user_id: UUID) -> list[CustomFieldDefinition]:
        list_ = await self.list_repo.get_by_id(list_id)
        if not list_:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="List not found")
        project = await self.project_repo.get_by_id(list_.project_id)
        if not project:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
        member = await self.workspace_repo.get_member(project.workspace_id, user_id)
        if not member:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a workspace member")
        fields = await self.repo.list_for_list(list_id)
        # filter by visibility_roles (empty = visible to all)
        return [f for f in fields if not f.visibility_roles or member.role.value in f.visibility_roles]

    async def create_field(
        self, list_id: UUID, dto: CreateFieldDTO, actor_id: UUID
    ) -> CustomFieldDefinition:
        await self._require_list_member(list_id, actor_id)
        max_order = await self.repo.get_max_order_index(list_id)
        order_index = max_order + 100.0
        full_dto = CreateFieldDTO(
            list_id=list_id,
            name=dto.name,
            field_type=dto.field_type,
            is_required=dto.is_required,
            options_json=dto.options_json,
            order_index=order_index,
            visibility_roles=dto.visibility_roles,
            editable_roles=dto.editable_roles,
        )
        return await self.repo.create_field(full_dto)

    async def update_field(
        self, list_id: UUID, field_id: UUID, dto: UpdateFieldDTO, actor_id: UUID
    ) -> CustomFieldDefinition:
        await self._require_list_member(list_id, actor_id)
        field = await self._get_field_or_404(field_id, list_id)
        return await self.repo.update_field(field, dto)

    async def delete_field(self, list_id: UUID, field_id: UUID, actor_id: UUID) -> None:
        await self._require_list_member(list_id, actor_id)
        field = await self._get_field_or_404(field_id, list_id)
        await self.repo.soft_delete_field(field)

    async def get_task_values(self, task_id: UUID, user_id: UUID) -> list[CustomFieldValue]:
        task = await self._get_task_or_404(task_id)
        await self._require_workspace_member(task.workspace_id, user_id)
        return await self.repo.get_values_for_task(task_id)

    async def upsert_task_values(
        self, task_id: UUID, values_dict: dict[str, Any], actor_id: UUID
    ) -> list[CustomFieldValue]:
        task = await self._get_task_or_404(task_id)
        member = await self.workspace_repo.get_member(task.workspace_id, actor_id)
        if not member:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a workspace member")

        if task.list_id is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Task has no list; cannot set field values",
            )

        # Validate required fields
        all_fields = await self.repo.list_for_list(task.list_id)
        required_fields = [f for f in all_fields if f.is_required]

        if required_fields:
            existing_values = await self.repo.get_values_for_task(task_id)
            existing_map = {str(v.field_id): v for v in existing_values}
            missing = []
            for req_field in required_fields:
                fid = str(req_field.id)
                # Check if it's being provided now
                if fid in values_dict:
                    val = values_dict[fid]
                    if val is None:
                        # Check if there's an existing non-null value
                        existing = existing_map.get(fid)
                        if not existing or _is_value_null(existing):
                            missing.append(req_field.name)
                else:
                    # Not in the update dict — check existing
                    existing = existing_map.get(fid)
                    if not existing or _is_value_null(existing):
                        missing.append(req_field.name)
            if missing:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"Required fields missing values: {', '.join(missing)}",
                )

        # Build a field map for type lookup
        field_map = {str(f.id): f for f in all_fields}

        # Check editable_roles before writing
        for field_id_str in values_dict:
            field_def = field_map.get(field_id_str)
            if field_def and field_def.editable_roles and member.role.value not in field_def.editable_roles:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Field '{field_def.name}' is not editable by your role",
                )

        results = []
        for field_id_str, raw_value in values_dict.items():
            field = field_map.get(field_id_str)
            if not field:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Field {field_id_str} not found in this list",
                )

            dto = _build_value_dto(
                task_id=task_id,
                field_id=field.id,
                field_type=field.field_type,
                raw_value=raw_value,
            )
            val = await self.repo.upsert_value(dto)
            results.append(val)

        return results

    async def _require_list_member(self, list_id: UUID, user_id: UUID) -> None:
        list_ = await self.list_repo.get_by_id(list_id)
        if not list_:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="List not found")
        project = await self.project_repo.get_by_id(list_.project_id)
        if not project:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
        await self._require_workspace_member(project.workspace_id, user_id)

    async def _require_workspace_member(self, workspace_id: UUID, user_id: UUID) -> None:
        member = await self.workspace_repo.get_member(workspace_id, user_id)
        if not member:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Not a workspace member"
            )

    async def _get_field_or_404(
        self, field_id: UUID, list_id: UUID
    ) -> CustomFieldDefinition:
        field = await self.repo.get_field_by_id(field_id)
        if not field or field.list_id != list_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Field not found"
            )
        return field

    async def _get_task_or_404(self, task_id: UUID):
        task = await self.task_repo.get_by_id(task_id)
        if not task:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Task not found"
            )
        return task


def _is_value_null(value: CustomFieldValue) -> bool:
    return (
        value.value_text is None
        and value.value_number is None
        and value.value_date is None
        and value.value_boolean is None
        and value.value_json is None
    )


def _build_value_dto(
    task_id: UUID,
    field_id: UUID,
    field_type: FieldType,
    raw_value: Any,
) -> UpsertFieldValueDTO:
    value_text = None
    value_number = None
    value_date = None
    value_boolean = None
    value_json = None

    if raw_value is None:
        pass
    elif field_type == FieldType.text or field_type == FieldType.url:
        value_text = str(raw_value)
    elif field_type == FieldType.number:
        value_number = float(raw_value)
    elif field_type == FieldType.date:
        if isinstance(raw_value, datetime):
            value_date = raw_value
        else:
            value_date = datetime.fromisoformat(str(raw_value))
    elif field_type == FieldType.checkbox:
        value_boolean = bool(raw_value)
    elif field_type == FieldType.dropdown:
        if isinstance(raw_value, dict):
            value_json = raw_value
        else:
            value_json = {"selected": raw_value}

    return UpsertFieldValueDTO(
        task_id=task_id,
        field_id=field_id,
        value_text=value_text,
        value_number=value_number,
        value_date=value_date,
        value_boolean=value_boolean,
        value_json=value_json,
    )
