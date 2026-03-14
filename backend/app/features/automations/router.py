from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.security import get_current_user
from app.features.automations.repository import AutomationRepository
from app.features.automations.schemas import AutomationResponse, CreateAutomationRequest
from app.features.automations.service import AutomationService
from app.features.lists.repository import ListRepository
from app.features.projects.repository import ProjectRepository
from app.features.workspaces.repository import WorkspaceRepository
from app.models.user import User

router = APIRouter(tags=["automations"])


def get_service(session: AsyncSession = Depends(get_session)) -> AutomationService:
    return AutomationService(
        repo=AutomationRepository(session),
        list_repo=ListRepository(session),
        project_repo=ProjectRepository(session),
        workspace_repo=WorkspaceRepository(session),
    )


@router.get("/lists/{list_id}/automations", response_model=list[AutomationResponse])
async def list_automations(
    list_id: UUID,
    current_user: User = Depends(get_current_user),
    service: AutomationService = Depends(get_service),
):
    automations = await service.list_for_list(list_id, user_id=current_user.id)
    return [AutomationResponse.model_validate(a) for a in automations]


@router.post(
    "/lists/{list_id}/automations",
    response_model=AutomationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_automation(
    list_id: UUID,
    body: CreateAutomationRequest,
    current_user: User = Depends(get_current_user),
    service: AutomationService = Depends(get_service),
    session: AsyncSession = Depends(get_session),
):
    automation = await service.create(list_id, body, creator_id=current_user.id)
    await session.commit()
    return AutomationResponse.model_validate(automation)


@router.delete("/automations/{automation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_automation(
    automation_id: UUID,
    current_user: User = Depends(get_current_user),
    service: AutomationService = Depends(get_service),
    session: AsyncSession = Depends(get_session),
):
    await service.delete(automation_id, actor_id=current_user.id)
    await session.commit()
