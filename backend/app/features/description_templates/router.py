from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.security import get_current_user
from app.features.description_templates.repository import DescriptionTemplateRepository
from app.features.description_templates.schemas import (
    CreateDescriptionTemplateRequest,
    UpdateDescriptionTemplateRequest,
    CreateDescriptionTemplateDTO,
    UpdateDescriptionTemplateDTO,
    DescriptionTemplateResponse,
)
from app.features.description_templates.service import DescriptionTemplateService
from app.features.workspaces.repository import WorkspaceRepository
from app.models.user import User

router = APIRouter(tags=["description_templates"])


def get_service(session: AsyncSession = Depends(get_session)) -> DescriptionTemplateService:
    return DescriptionTemplateService(
        repo=DescriptionTemplateRepository(session),
        workspace_repo=WorkspaceRepository(session),
    )


@router.get(
    "/workspaces/{workspace_id}/description-templates",
    response_model=list[DescriptionTemplateResponse],
)
async def list_description_templates(
    workspace_id: UUID,
    current_user: User = Depends(get_current_user),
    service: DescriptionTemplateService = Depends(get_service),
):
    templates = await service.list_templates(workspace_id, user_id=current_user.id)
    return [DescriptionTemplateResponse.model_validate(t) for t in templates]


@router.post(
    "/workspaces/{workspace_id}/description-templates",
    response_model=DescriptionTemplateResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_description_template(
    workspace_id: UUID,
    body: CreateDescriptionTemplateRequest,
    current_user: User = Depends(get_current_user),
    service: DescriptionTemplateService = Depends(get_service),
    session: AsyncSession = Depends(get_session),
):
    dto = CreateDescriptionTemplateDTO(
        workspace_id=workspace_id,
        name=body.name,
        content=body.content,
        created_by=current_user.id,
    )
    template = await service.create(workspace_id, dto, actor_id=current_user.id)
    await session.commit()
    return DescriptionTemplateResponse.model_validate(template)


@router.patch(
    "/workspaces/{workspace_id}/description-templates/{template_id}",
    response_model=DescriptionTemplateResponse,
)
async def update_description_template(
    workspace_id: UUID,
    template_id: UUID,
    body: UpdateDescriptionTemplateRequest,
    current_user: User = Depends(get_current_user),
    service: DescriptionTemplateService = Depends(get_service),
    session: AsyncSession = Depends(get_session),
):
    dto = UpdateDescriptionTemplateDTO(name=body.name, content=body.content)
    template = await service.update(workspace_id, template_id, dto, actor_id=current_user.id)
    await session.commit()
    return DescriptionTemplateResponse.model_validate(template)


@router.delete(
    "/workspaces/{workspace_id}/description-templates/{template_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_description_template(
    workspace_id: UUID,
    template_id: UUID,
    current_user: User = Depends(get_current_user),
    service: DescriptionTemplateService = Depends(get_service),
    session: AsyncSession = Depends(get_session),
):
    await service.delete(workspace_id, template_id, actor_id=current_user.id)
    await session.commit()
