from uuid import UUID
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_session
from app.core.security import get_current_user
from app.features.links.repository import LinkRepository
from app.features.links.schemas import CreateLinkRequest, LinkResponse
from app.features.links.service import LinkService
from app.features.tasks.repository import TaskRepository
from app.features.workspaces.repository import WorkspaceRepository
from app.features.audit.repository import AuditRepository
from app.models.user import User

router = APIRouter(tags=["links"])


def get_service(session: AsyncSession = Depends(get_session)) -> LinkService:
    return LinkService(
        repo=LinkRepository(session),
        task_repo=TaskRepository(session),
        workspace_repo=WorkspaceRepository(session),
        audit_repo=AuditRepository(session),
    )


@router.post("/tasks/{task_id}/links", response_model=LinkResponse, status_code=201)
async def add_link(
    task_id: UUID,
    body: CreateLinkRequest,
    current_user: User = Depends(get_current_user),
    service: LinkService = Depends(get_service),
    session: AsyncSession = Depends(get_session),
):
    link = await service.create(task_id, body.url, body.title, actor_id=current_user.id)
    await session.commit()
    return LinkResponse.model_validate(link)


@router.get("/tasks/{task_id}/links", response_model=list[LinkResponse])
async def list_links(
    task_id: UUID,
    current_user: User = Depends(get_current_user),
    service: LinkService = Depends(get_service),
):
    links = await service.list_for_task(task_id, user_id=current_user.id)
    return [LinkResponse.model_validate(l) for l in links]


@router.delete("/tasks/{task_id}/links/{link_id}", status_code=204)
async def delete_link(
    task_id: UUID,
    link_id: UUID,
    current_user: User = Depends(get_current_user),
    service: LinkService = Depends(get_service),
    session: AsyncSession = Depends(get_session),
):
    await service.delete(task_id, link_id, actor_id=current_user.id)
    await session.commit()
