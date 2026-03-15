from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.security import get_current_user
from app.core.pubsub import publish_task_event
from app.core.email import send_email
from app.core.email_templates import mention_email, watcher_update_email
from app.core.config import settings
from app.features.audit.repository import AuditRepository
from app.features.comments.repository import CommentRepository
from app.features.comments.schemas import CommentResponse, CreateCommentRequest
from app.features.comments.service import CommentService
from app.features.notifications.repository import NotificationRepository
from app.features.tasks.repository import TaskRepository
from app.features.watchers.repository import WatcherRepository
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
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    service: CommentService = Depends(_get_service),
    session: AsyncSession = Depends(get_session),
):
    comment = await service.create(task_id, body.body, body.parent_comment_id, current_user.id)
    await session.commit()

    # Publish real-time event
    await publish_task_event(task_id, actor_id=current_user.id, event="task.comment_added", data={"comment_id": str(comment.id)})

    notif_repo = NotificationRepository(session)
    mentioned_ids: set[str] = set()

    ws_repo = WorkspaceRepository(session)
    task_obj = await TaskRepository(session).get_by_id(task_id)
    task_title = task_obj.title if task_obj else "a task"
    task_url = f"{settings.frontend_url}/tasks/{task_id}"

    # Create mention notifications + emails
    if comment.mentions:
        for user_id in comment.mentions:
            mentioned_ids.add(str(user_id))
            await notif_repo.create(
                user_id=user_id,
                task_id=task_id,
                type_="mention",
                body=f"{current_user.display_name} mentioned you in a comment",
                meta={"comment_id": str(comment.id)},
            )
            user = await ws_repo.get_user_by_id(user_id)
            if user and user.email:
                background_tasks.add_task(
                    send_email,
                    to=user.email,
                    subject=f"You were mentioned in \"{task_title}\"",
                    html=mention_email(current_user.display_name, task_title, task_url),
                )

    # Notify watchers (skip author and already-mentioned users)
    watcher_repo = WatcherRepository(session)
    watcher_ids = await watcher_repo.list_watcher_ids(task_id)
    for watcher_id in watcher_ids:
        if watcher_id != current_user.id and str(watcher_id) not in mentioned_ids:
            await notif_repo.create(
                user_id=watcher_id,
                task_id=task_id,
                type_="task_updated",
                body=f"{current_user.display_name} commented on \"{task_title}\"",
                meta={"comment_id": str(comment.id)},
            )
            user = await ws_repo.get_user_by_id(watcher_id)
            if user and user.email:
                background_tasks.add_task(
                    send_email,
                    to=user.email,
                    subject=f"New comment on \"{task_title}\"",
                    html=watcher_update_email(task_title, "comment", task_url),
                )

    if comment.mentions or watcher_ids:
        await session.commit()

    return CommentResponse(
        id=comment.id,
        task_id=comment.task_id,
        author_id=comment.author_id,
        author_name=current_user.display_name,
        body=comment.body,
        parent_comment_id=comment.parent_comment_id,
        mentions=comment.mentions,
        created_at=comment.created_at,
        updated_at=comment.updated_at,
    )


@router.get("/tasks/{task_id}/comments", response_model=list[CommentResponse])
async def list_comments(
    task_id: UUID,
    current_user: User = Depends(get_current_user),
    service: CommentService = Depends(_get_service),
):
    rows = await service.list_for_task(task_id, current_user.id)
    return [
        CommentResponse(
            id=c.id,
            task_id=c.task_id,
            author_id=c.author_id,
            author_name=author_name,
            body=c.body,
            parent_comment_id=c.parent_comment_id,
            mentions=c.mentions,
            created_at=c.created_at,
            updated_at=c.updated_at,
        )
        for c, author_name in rows
    ]


@router.delete("/tasks/{task_id}/comments/{comment_id}", status_code=204)
async def delete_comment(
    task_id: UUID,
    comment_id: UUID,
    current_user: User = Depends(get_current_user),
    service: CommentService = Depends(_get_service),
    session: AsyncSession = Depends(get_session),
):
    await service.delete(comment_id, current_user.id)
    await session.commit()
