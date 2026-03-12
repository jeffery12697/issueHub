from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.security import get_current_user
from app.features.audit.repository import AuditRepository
from app.features.comments.repository import CommentRepository
from app.features.comments.schemas import CommentResponse, CreateCommentRequest
from app.features.comments.service import CommentService
from app.features.tasks.repository import TaskRepository
from app.features.workspaces.repository import WorkspaceRepository
from app.models.user import User

router = APIRouter(tags=["comments"])


def _get_service(session: AsyncSession = Depends(get_session)) -> CommentService:
    return CommentService(
        repo=CommentRepository(session),
        task_repo=TaskRepository(session),
        workspace_repo=WorkspaceRepository(session),
        audit_repo=AuditRepository(session),
    )


@router.post("/tasks/{task_id}/comments", response_model=CommentResponse, status_code=201)
async def create_comment(
    task_id: UUID,
    body: CreateCommentRequest,
    current_user: User = Depends(get_current_user),
    service: CommentService = Depends(_get_service),
):
    return await service.create(task_id, body.body, body.parent_comment_id, current_user.id)


@router.get("/tasks/{task_id}/comments", response_model=list[CommentResponse])
async def list_comments(
    task_id: UUID,
    current_user: User = Depends(get_current_user),
    service: CommentService = Depends(_get_service),
):
    return await service.list_for_task(task_id, current_user.id)


@router.delete("/tasks/{task_id}/comments/{comment_id}", status_code=204)
async def delete_comment(
    task_id: UUID,
    comment_id: UUID,
    current_user: User = Depends(get_current_user),
    service: CommentService = Depends(_get_service),
):
    await service.delete(comment_id, current_user.id)
