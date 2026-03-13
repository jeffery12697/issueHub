import csv
import io
from uuid import UUID

from fastapi import APIRouter, Depends, Request, status
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
    UpdateTaskRequest,
    TaskResponse,
)
from app.features.lists.repository import ListRepository
from app.features.projects.repository import ProjectRepository
from app.features.workspaces.repository import WorkspaceRepository
from app.features.audit.repository import AuditRepository
from app.models.task import Priority
from app.models.user import User

router = APIRouter(tags=["tasks"])


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
    status_id: UUID | None = None,
    priority: Priority | None = None,
    assignee_id: UUID | None = None,
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

    tasks = await service.list_for_list(
        list_id,
        user_id=current_user.id,
        status_id=status_id,
        priority=priority,
        assignee_id=assignee_id,
        cf_filters=cf_filters if cf_filters else None,
    )
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
    task = await service.update(task_id, body.to_dto(), actor_id=current_user.id)
    await session.commit()
    response = TaskResponse.model_validate(task)
    await publish_task_event(task_id, actor_id=current_user.id, event="task.updated", data={"task": response.model_dump(mode="json")})
    if task.list_id:
        await publish_list_event(task.list_id, task_id=task_id, actor_id=current_user.id, event="task.updated")
    return response


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
    tasks = await service.list_for_list(list_id, user_id=current_user.id)

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
