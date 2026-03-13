from uuid import UUID

from sqlalchemy import select, func
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.custom_field import CustomFieldDefinition, CustomFieldValue
from app.features.custom_fields.schemas import CreateFieldDTO, UpdateFieldDTO, UpsertFieldValueDTO


class CustomFieldRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def list_for_list(self, list_id: UUID) -> list[CustomFieldDefinition]:
        result = await self.session.execute(
            select(CustomFieldDefinition)
            .where(CustomFieldDefinition.list_id == list_id)
            .where(CustomFieldDefinition.deleted_at.is_(None))
            .order_by(CustomFieldDefinition.order_index)
        )
        return list(result.scalars().all())

    async def get_field_by_id(self, field_id: UUID) -> CustomFieldDefinition | None:
        result = await self.session.execute(
            select(CustomFieldDefinition)
            .where(CustomFieldDefinition.id == field_id)
            .where(CustomFieldDefinition.deleted_at.is_(None))
        )
        return result.scalar_one_or_none()

    async def get_max_order_index(self, list_id: UUID) -> float:
        result = await self.session.execute(
            select(func.max(CustomFieldDefinition.order_index))
            .where(CustomFieldDefinition.list_id == list_id)
            .where(CustomFieldDefinition.deleted_at.is_(None))
        )
        return result.scalar_one_or_none() or 0.0

    async def create_field(self, dto: CreateFieldDTO) -> CustomFieldDefinition:
        field = CustomFieldDefinition(
            list_id=dto.list_id,
            name=dto.name,
            field_type=dto.field_type,
            is_required=dto.is_required,
            options_json=dto.options_json,
            order_index=dto.order_index,
            visibility_roles=list(dto.visibility_roles),
            editable_roles=list(dto.editable_roles),
        )
        self.session.add(field)
        await self.session.flush()
        return field

    async def update_field(self, field: CustomFieldDefinition, dto: UpdateFieldDTO) -> CustomFieldDefinition:
        if dto.name is not None:
            field.name = dto.name
        if dto.is_required is not None:
            field.is_required = dto.is_required
        if dto.options_json is not None:
            field.options_json = dto.options_json
        if dto.visibility_roles is not None:
            field.visibility_roles = list(dto.visibility_roles)
        if dto.editable_roles is not None:
            field.editable_roles = list(dto.editable_roles)
        await self.session.flush()
        return field

    async def soft_delete_field(self, field: CustomFieldDefinition) -> None:
        field.soft_delete()
        await self.session.flush()

    async def get_values_for_task(self, task_id: UUID) -> list[CustomFieldValue]:
        result = await self.session.execute(
            select(CustomFieldValue)
            .where(CustomFieldValue.task_id == task_id)
        )
        return list(result.scalars().all())

    async def upsert_value(self, dto: UpsertFieldValueDTO) -> CustomFieldValue:
        from uuid import uuid4
        stmt = (
            insert(CustomFieldValue)
            .values(
                id=uuid4(),
                task_id=dto.task_id,
                field_id=dto.field_id,
                value_text=dto.value_text,
                value_number=dto.value_number,
                value_date=dto.value_date,
                value_boolean=dto.value_boolean,
                value_json=dto.value_json,
            )
            .on_conflict_do_update(
                constraint="uq_custom_field_values_task_field",
                set_={
                    "value_text": dto.value_text,
                    "value_number": dto.value_number,
                    "value_date": dto.value_date,
                    "value_boolean": dto.value_boolean,
                    "value_json": dto.value_json,
                },
            )
            .returning(CustomFieldValue)
        )
        result = await self.session.execute(stmt)
        await self.session.flush()
        return result.scalar_one()
