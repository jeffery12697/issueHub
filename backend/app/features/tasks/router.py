import csv
import io
from uuid import UUID

from fastapi import APIRouter, Depends, Request, Response, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.security import get_current_user
from app.core.pubsub import publish_task_event, publish_list_event
from app.features.tasks.repository import TaskRepository
from app.features.tasks.service import TaskService
from app.features.tasks.schemas import (
    BulkUpdateRequest,
    BulkDeleteRequest,
    BulkOperationResponse,
    CreateTaskRequest,
    MoveTaskRequest,
    UpdateTaskRequest,
    TaskResponse,
)
from app.features.lists.repository import ListRepository
from app.features.projects.repository import ProjectRepository
from app.features.workspaces.repository import WorkspaceRepository
from app.features.audit.repository import AuditRepository
from app.features.notifications.repository import NotificationRepository
from app.features.watchers.repository import WatcherRepository
from app.models.task import Task, Priority
from app.models.user import User

router = APIRouter(tags=["tasks"])


async def maybe_close_parent(task: Task, session: AsyncSession, actor_id: UUID) -> None:
    """Auto-close parent task if all its subtasks are now complete (AU-03)."""
    if not task.parent_task_id:
        return

    task_repo = TaskRepository(session)
    list_repo = ListRepository(session)

    # All subtasks of the parent must have a complete status
    siblings = await task_repo.list_subtasks(task.parent_task_id)
    if not siblings:
        return
    for sibling in siblings:
        if not sibling.status_id:
            return
        s = await list_repo.get_status_by_id(sibling.status_id)
        if not s or not s.is_complete:
            return

    # Parent already closed? Skip.
    parent = await task_repo.get_by_id(task.parent_task_id)
    if not parent or not parent.list_id:
        return
    if parent.status_id:
        ps = await list_repo.get_status_by_id(parent.status_id)
        if ps and ps.is_complete:
            return

    # Find first complete status in parent's list and apply it
    statuses = await list_repo.list_statuses(parent.list_id)
    complete_status = next((s for s in statuses if s.is_complete), None)
    if not complete_status:
        return

    from app.features.tasks.schemas import UpdateTaskDTO
    await task_repo.update(parent, UpdateTaskDTO(status_id=complete_status.id))

    audit_repo = AuditRepository(session)
    await audit_repo.log(
        task_id=parent.id,
        actor_id=actor_id,
        action="auto_closed",
        changes={"status": [None, complete_status.name]},
    )
    await session.commit()


def get_service(session: AsyncSession = Depends(get_session)) -> TaskService:
    return TaskService(
        repo=TaskRepository(session),
        list_repo=ListRepository(session),
        project_repo=ProjectRepository(session),
        workspace_repo=WorkspaceRepository(session),
        audit_repo=AuditRepository(session),
    )


@router.get("/lists/{list_id}/tasks", response_model=list[TaskResponse])
async def list_tasks(
    list_id: UUID,
    request: Request,
    response: Response,
    status_id: UUID | None = None,
    priority: Priority | None = None,
    assignee_id: UUID | None = None,
    include_subtasks: bool = False,
    page: int = 1,
    page_size: int = 0,
    current_user: User = Depends(get_current_user),
    service: TaskService = Depends(get_service),
):
    # Parse cf[<uuid>]=value query params
    cf_filters: dict[UUID, str] = {}
    for key, value in request.query_params.items():
        if key.startswith("cf[") and key.endswith("]"):
            field_id_str = key[3:-1]
            try:
                cf_filters[UUID(field_id_str)] = value
            except ValueError:
                pass

    tasks, total = await service.list_for_list(
        list_id,
        user_id=current_user.id,
        status_id=status_id,
        priority=priority,
        assignee_id=assignee_id,
        cf_filters=cf_filters if cf_filters else None,
        include_subtasks=include_subtasks,
        page=page,
        page_size=page_size,
    )
    response.headers["X-Total-Count"] = str(total)
    return [TaskResponse.model_validate(t) for t in tasks]


@router.post("/lists/{list_id}/tasks", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(
    list_id: UUID,
    body: CreateTaskRequest,
    current_user: User = Depends(get_current_user),
    service: TaskService = Depends(get_service),
    session: AsyncSession = Depends(get_session),
):
    list_repo = ListRepository(session)
    project_repo = ProjectRepository(session)

    list_ = await list_repo.get_by_id(list_id)
    if not list_:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="List not found")

    project = await project_repo.get_by_id(list_.project_id)

    task = await service.create(
        body.to_dto(
            list_id=list_id,
            workspace_id=project.workspace_id,
            project_id=project.id,
            reporter_id=current_user.id,
        )
    )
    await session.commit()
    return TaskResponse.model_validate(task)


@router.get("/tasks/{task_id}", response_model=TaskResponse)
async def get_task(
    task_id: UUID,
    current_user: User = Depends(get_current_user),
    service: TaskService = Depends(get_service),
):
    task = await service.get_or_404(task_id)
    return TaskResponse.model_validate(task)


@router.get("/tasks/{task_id}/subtasks", response_model=list[TaskResponse])
async def list_subtasks(
    task_id: UUID,
    current_user: User = Depends(get_current_user),
    service: TaskService = Depends(get_service),
):
    subtasks = await service.list_subtasks(task_id, user_id=current_user.id)
    return [TaskResponse.model_validate(t) for t in subtasks]


@router.post("/tasks/{task_id}/subtasks", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_subtask(
    task_id: UUID,
    body: CreateTaskRequest,
    current_user: User = Depends(get_current_user),
    service: TaskService = Depends(get_service),
    session: AsyncSession = Depends(get_session),
):
    task = await service.create_subtask(task_id, body, actor_id=current_user.id)
    await session.commit()
    return TaskResponse.model_validate(task)


@router.post("/tasks/{task_id}/promote", response_model=TaskResponse)
async def promote_task(
    task_id: UUID,
    current_user: User = Depends(get_current_user),
    service: TaskService = Depends(get_service),
    session: AsyncSession = Depends(get_session),
):
    task = await service.promote(task_id, actor_id=current_user.id)
    await session.commit()
    return TaskResponse.model_validate(task)


@router.patch("/tasks/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: UUID,
    body: UpdateTaskRequest,
    current_user: User = Depends(get_current_user),
    service: TaskService = Depends(get_service),
    session: AsyncSession = Depends(get_session),
):
    # Capture old assignees before update for diff
    old_task = await service.get_or_404(task_id)
    old_assignee_ids = {str(i) for i in old_task.assignee_ids}

    task = await service.update(task_id, body.to_dto(), actor_id=current_user.id)
    await session.commit()

    notif_repo = NotificationRepository(session)

    # Notify newly added assignees
    if body.assignee_ids is not None:
        new_assignee_ids = {str(i) for i in body.assignee_ids}
        for uid_str in new_assignee_ids - old_assignee_ids:
            if uid_str != str(current_user.id):
                await notif_repo.create(
                    user_id=UUID(uid_str),
                    task_id=task_id,
                    type_="assigned",
                    body=f"{current_user.display_name} assigned you to \"{task.title}\"",
                    meta={"task_id": str(task_id)},
                )

    # Notify watchers (except the actor)
    watcher_repo = WatcherRepository(session)
    watcher_ids = await watcher_repo.list_watcher_ids(task_id)
    for watcher_id in watcher_ids:
        if watcher_id != current_user.id:
            await notif_repo.create(
                user_id=watcher_id,
                task_id=task_id,
                type_="task_updated",
                body=f"{current_user.display_name} updated \"{task.title}\"",
                meta={"task_id": str(task_id)},
            )

    if watcher_ids or (body.assignee_ids is not None):
        await session.commit()

    # AU-03: auto-close parent if all subtasks are now complete
    if body.status_id is not None:
        await maybe_close_parent(task, session, actor_id=current_user.id)

    response = TaskResponse.model_validate(task)
    await publish_task_event(task_id, actor_id=current_user.id, event="task.updated", data={"task": response.model_dump(mode="json")})
    if task.list_id:
        await publish_list_event(task.list_id, task_id=task_id, actor_id=current_user.id, event="task.updated")
    return response


@router.patch("/tasks/{task_id}/move", response_model=TaskResponse)
async def move_task(
    task_id: UUID,
    body: MoveTaskRequest,
    current_user: User = Depends(get_current_user),
    service: TaskService = Depends(get_service),
    session: AsyncSession = Depends(get_session),
):
    task = await service.move(task_id, body.list_id, actor_id=current_user.id)
    await session.commit()
    return TaskResponse.model_validate(task)


@router.get("/workspaces/{workspace_id}/me/tasks", response_model=list[TaskResponse])
async def list_my_tasks(
    workspace_id: UUID,
    status_id: UUID | None = None,
    priority: Priority | None = None,
    current_user: User = Depends(get_current_user),
    service: TaskService = Depends(get_service),
):
    tasks = await service.list_my_tasks(
        workspace_id,
        user_id=current_user.id,
        status_id=status_id,
        priority=priority,
    )
    return [TaskResponse.model_validate(t) for t in tasks]


@router.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    task_id: UUID,
    current_user: User = Depends(get_current_user),
    service: TaskService = Depends(get_service),
    session: AsyncSession = Depends(get_session),
):
    await service.delete(task_id, actor_id=current_user.id)
    await session.commit()


@router.get("/lists/{list_id}/tasks/export")
async def export_tasks_csv(
    list_id: UUID,
    current_user: User = Depends(get_current_user),
    service: TaskService = Depends(get_service),
    session: AsyncSession = Depends(get_session),
):
    tasks, _ = await service.list_for_list(list_id, user_id=current_user.id)

    list_repo = ListRepository(session)
    statuses = await list_repo.list_statuses(list_id)
    status_map = {str(s.id): s.name for s in statuses}

    # Resolve workspace_id from first task (or list)
    workspace_repo = WorkspaceRepository(session)
    workspace_id = tasks[0].workspace_id if tasks else None
    member_map: dict[str, str] = {}
    if workspace_id:
        members = await workspace_repo.list_member_users(workspace_id)
        member_map = {str(m.id): m.display_name for m in members}

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["id", "title", "status", "priority", "assignees", "created_at"])
    for task in tasks:
        status_name = status_map.get(str(task.status_id), "") if task.status_id else ""
        assignees = ", ".join(member_map.get(str(aid), str(aid)) for aid in task.assignee_ids)
        writer.writerow([
            str(task.id),
            task.title,
            status_name,
            task.priority.value if hasattr(task.priority, "value") else str(task.priority),
            assignees,
            task.created_at.isoformat() if task.created_at else "",
        ])
    csv_str = output.getvalue()
    return StreamingResponse(
        iter([csv_str]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=tasks.csv"},
    )


@router.get("/workspaces/{workspace_id}/search", response_model=list[TaskResponse])
async def search_tasks(
    workspace_id: UUID,
    q: str = "",
    current_user: User = Depends(get_current_user),
    service: TaskService = Depends(get_service),
):
    if len(q) < 2:
        return []
    tasks = await service.search(workspace_id, q, actor_id=current_user.id)
    return [TaskResponse.model_validate(t) for t in tasks]


@router.post("/tasks/bulk-update", response_model=BulkOperationResponse)
async def bulk_update_tasks(
    body: BulkUpdateRequest,
    current_user: User = Depends(get_current_user),
    service: TaskService = Depends(get_service),
    session: AsyncSession = Depends(get_session),
):
    updated = await service.bulk_update(
        task_ids=body.task_ids,
        status_id=body.status_id,
        priority=body.priority.value if body.priority else None,
        actor_id=current_user.id,
    )
    await session.commit()
    return BulkOperationResponse(updated=updated)


@router.post("/tasks/bulk-delete", response_model=BulkOperationResponse)
async def bulk_delete_tasks(
    body: BulkDeleteRequest,
    current_user: User = Depends(get_current_user),
    service: TaskService = Depends(get_service),
    session: AsyncSession = Depends(get_session),
):
    updated = await service.bulk_delete(task_ids=body.task_ids, actor_id=current_user.id)
    await session.commit()
    return BulkOperationResponse(updated=updated)
