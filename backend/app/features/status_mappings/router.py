from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.security import get_current_user
from app.features.status_mappings.repository import StatusMappingRepository
from app.features.status_mappings.schemas import StatusMappingResponse, StatusMappingUpsert
from app.features.projects.repository import ProjectRepository
from app.features.workspaces.repository import WorkspaceRepository
from app.models.user import User

router = APIRouter(tags=["status_mappings"])


async def _require_project_member(
    project_id: UUID,
    current_user: User,
    session: AsyncSession,
) -> None:
    project_repo = ProjectRepository(session)
    project = await project_repo.get_by_id(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    ws_repo = WorkspaceRepository(session)
    member = await ws_repo.get_member(project.workspace_id, current_user.id)
    if not member:
        raise HTTPException(status_code=403, detail="Not a workspace member")


@router.get("/projects/{project_id}/status-mappings", response_model=list[StatusMappingResponse])
async def list_status_mappings(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    await _require_project_member(project_id, current_user, session)
    repo = StatusMappingRepository(session)
    mappings = await repo.list_for_project(project_id)
    return [StatusMappingResponse.model_validate(m) for m in mappings]


@router.put(
    "/projects/{project_id}/status-mappings",
    response_model=StatusMappingResponse,
    status_code=status.HTTP_200_OK,
)
async def upsert_status_mapping(
    project_id: UUID,
    body: StatusMappingUpsert,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    await _require_project_member(project_id, current_user, session)
    repo = StatusMappingRepository(session)
    mapping = await repo.upsert(
        project_id=project_id,
        from_list_id=body.from_list_id,
        from_status_id=body.from_status_id,
        to_list_id=body.to_list_id,
        to_status_id=body.to_status_id,
    )
    await session.commit()
    return StatusMappingResponse.model_validate(mapping)


@router.delete("/projects/{project_id}/status-mappings/{mapping_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_status_mapping(
    project_id: UUID,
    mapping_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    await _require_project_member(project_id, current_user, session)
    repo = StatusMappingRepository(session)
    deleted = await repo.delete_by_id(mapping_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Mapping not found")
    await session.commit()
