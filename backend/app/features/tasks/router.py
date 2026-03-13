from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.security import get_current_user
from app.core.pubsub import publish_task_event, publish_list_event
from app.features.tasks.repository import TaskRepository
from app.features.tasks.service import TaskService
from app.features.tasks.schemas import (
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
    status_id: UUID | None = None,
    priority: Priority | None = None,
    assignee_id: UUID | None = None,
    current_user: User = Depends(get_current_user),
    service: TaskService = Depends(get_service),
):
    tasks = await service.list_for_list(
        list_id,
        user_id=current_user.id,
        status_id=status_id,
        priority=priority,
        assignee_id=assignee_id,
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
