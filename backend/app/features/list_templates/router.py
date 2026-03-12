from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.security import get_current_user
from app.features.list_templates.repository import ListTemplateRepository
from app.features.list_templates.schemas import (
    CreateListFromTemplateRequest,
    CreateListFromTemplateDTO,
    CreateTemplateDTO,
    CreateTemplateRequest,
    TemplateResponse,
    UpdateTemplateRequest,
)
from app.features.list_templates.service import ListTemplateService
from app.features.lists.repository import ListRepository
from app.features.lists.schemas import ListResponse
from app.features.projects.repository import ProjectRepository
from app.features.workspaces.repository import WorkspaceRepository
from app.models.user import User

router = APIRouter(tags=["list_templates"])


def get_service(session: AsyncSession = Depends(get_session)) -> ListTemplateService:
    return ListTemplateService(
        repo=ListTemplateRepository(session),
        list_repo=ListRepository(session),
        project_repo=ProjectRepository(session),
        workspace_repo=WorkspaceRepository(session),
    )


@router.get(
    "/workspaces/{workspace_id}/list-templates",
    response_model=list[TemplateResponse],
)
async def list_templates(
    workspace_id: UUID,
    current_user: User = Depends(get_current_user),
    service: ListTemplateService = Depends(get_service),
):
    templates = await service.list_templates(workspace_id, user_id=current_user.id)
    return [TemplateResponse.model_validate(t) for t in templates]


@router.post(
    "/workspaces/{workspace_id}/list-templates",
    response_model=TemplateResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_template(
    workspace_id: UUID,
    body: CreateTemplateRequest,
    current_user: User = Depends(get_current_user),
    service: ListTemplateService = Depends(get_service),
    session: AsyncSession = Depends(get_session),
):
    dto = CreateTemplateDTO(
        workspace_id=workspace_id,
        name=body.name,
        default_statuses=body.default_statuses,
        default_custom_fields=body.default_custom_fields,
    )
    template = await service.create_template(workspace_id, dto, actor_id=current_user.id)
    await session.commit()
    return TemplateResponse.model_validate(template)


@router.delete(
    "/workspaces/{workspace_id}/list-templates/{template_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_template(
    workspace_id: UUID,
    template_id: UUID,
    current_user: User = Depends(get_current_user),
    service: ListTemplateService = Depends(get_service),
    session: AsyncSession = Depends(get_session),
):
    await service.delete_template(workspace_id, template_id, actor_id=current_user.id)
    await session.commit()


@router.patch(
    "/workspaces/{workspace_id}/list-templates/{template_id}",
    response_model=TemplateResponse,
)
async def update_template(
    workspace_id: UUID,
    template_id: UUID,
    body: UpdateTemplateRequest,
    current_user: User = Depends(get_current_user),
    service: ListTemplateService = Depends(get_service),
    session: AsyncSession = Depends(get_session),
):
    from app.features.list_templates.schemas import UpdateTemplateDTO
    dto = UpdateTemplateDTO(name=body.name, default_statuses=body.default_statuses, default_custom_fields=body.default_custom_fields)
    template = await service.update_template(workspace_id, template_id, dto, actor_id=current_user.id)
    await session.commit()
    return TemplateResponse.model_validate(template)


@router.post(
    "/projects/{project_id}/lists/from-template",
    response_model=ListResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_list_from_template(
    project_id: UUID,
    body: CreateListFromTemplateRequest,
    current_user: User = Depends(get_current_user),
    service: ListTemplateService = Depends(get_service),
    session: AsyncSession = Depends(get_session),
):
    dto = CreateListFromTemplateDTO(
        project_id=project_id,
        name=body.name,
        template_id=body.template_id,
        created_by=current_user.id,
    )
    list_ = await service.create_list_from_template(project_id, dto, actor_id=current_user.id)
    await session.commit()
    return ListResponse.model_validate(list_)
