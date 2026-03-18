import csv
import io
from datetime import date
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, Request, Response, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.security import get_current_user
from app.core.pubsub import publish_task_event, publish_list_event
from app.core.email import send_email
from app.core.email_templates import assignment_email, watcher_update_email
from app.core.config import settings
from app.features.tasks.repository import TaskRepository
from app.features.tasks.service import TaskService
from app.features.tasks.schemas import (
    BulkUpdateRequest,
    BulkDeleteRequest,
    BulkMoveRequest,
    BulkOperationResponse,
    CreateTaskRequest,
    MoveTaskRequest,
    UpdateTaskRequest,
    TaskResponse,
    TaskSearchResult,
)
from app.features.lists.repository import ListRepository
from app.features.projects.repository import ProjectRepository
from app.features.workspaces.repository import WorkspaceRepository
from app.features.workspaces.schemas import AnalyticsResponse, StatusCount
from app.features.audit.repository import AuditRepository
from app.features.automations.repository import AutomationRepository
from app.features.teams.repository import TeamRepository
from app.features.notifications.repository import NotificationRepository
from app.features.watchers.repository import WatcherRepository
from app.features.status_mappings.repository import StatusMappingRepository
from app.features.webhooks.repository import GitLinkRepository
from app.features.webhooks.schemas import TaskGitLinkResponse
from app.features.tags.repository import TagRepository
from app.models.custom_field import CustomFieldDefinition, CustomFieldValue
from app.models.epic import Epic
from app.models.task import Task, Priority
from app.models.time_entry import TimeEntry
from app.models.user import User

router = APIRouter(tags=["tasks"])


def get_tag_repo(session: AsyncSession = Depends(get_session)) -> TagRepository:
    return TagRepository(session)


async def _build_task_responses(tasks: list[Task], tag_repo: TagRepository) -> list[TaskResponse]:
    """Build TaskResponse list with tag_ids populated from a single batch query."""
    if not tasks:
        return []
    tag_map = await tag_repo.get_tag_ids_for_tasks([t.id for t in tasks])
    return [
        TaskResponse.model_validate(t).model_copy(update={"tag_ids": tag_map.get(t.id, [])})
        for t in tasks
    ]


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
        automation_repo=AutomationRepository(session),
        team_repo=TeamRepository(session),
        status_mapping_repo=StatusMappingRepository(session),
    )


@router.get("/lists/{list_id}/tasks", response_model=list[TaskResponse])
async def list_tasks(
    list_id: UUID,
    request: Request,
    response: Response,
    status_id: UUID | None = None,
    status_id_not: str | None = None,
    priority: Priority | None = None,
    priority_not: str | None = None,
    assignee_id: UUID | None = None,
    tag_ids: str | None = None,
    include_subtasks: bool = False,
    page: int = 1,
    page_size: int = 0,
    sort_by: str | None = None,
    sort_dir: str | None = None,
    current_user: User = Depends(get_current_user),
    service: TaskService = Depends(get_service),
    tag_repo: TagRepository = Depends(get_tag_repo),
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

    # Parse comma-separated exclusion params
    status_ids_not: list[UUID] | None = None
    if status_id_not:
        try:
            status_ids_not = [UUID(s.strip()) for s in status_id_not.split(",") if s.strip()]
        except ValueError:
            pass

    priorities_not: list[Priority] | None = None
    if priority_not:
        try:
            priorities_not = [Priority(p.strip()) for p in priority_not.split(",") if p.strip()]
        except ValueError:
            pass

    parsed_tag_ids: list[UUID] | None = None
    if tag_ids:
        try:
            parsed_tag_ids = [UUID(t.strip()) for t in tag_ids.split(",") if t.strip()]
        except ValueError:
            pass

    tasks, total = await service.list_for_list(
        list_id,
        user_id=current_user.id,
        status_id=status_id,
        status_ids_not=status_ids_not,
        priority=priority,
        priorities_not=priorities_not,
        assignee_id=assignee_id,
        cf_filters=cf_filters if cf_filters else None,
        tag_ids=parsed_tag_ids,
        include_subtasks=include_subtasks,
        page=page,
        page_size=page_size,
        sort_by=sort_by,
        sort_dir=sort_dir,
    )
    response.headers["X-Total-Count"] = str(total)
    return await _build_task_responses(tasks, tag_repo)


@router.get("/projects/{project_id}/tasks", response_model=list[TaskResponse])
async def list_project_tasks(
    project_id: UUID,
    response: Response,
    list_id: UUID | None = None,
    priority: Priority | None = None,
    priority_not: str | None = None,
    assignee_id: UUID | None = None,
    tag_ids: str | None = None,
    include_subtasks: bool = False,
    page: int = 1,
    page_size: int = 0,
    sort_by: str | None = None,
    sort_dir: str | None = None,
    current_user: User = Depends(get_current_user),
    service: TaskService = Depends(get_service),
    tag_repo: TagRepository = Depends(get_tag_repo),
):
    priorities_not: list[Priority] | None = None
    if priority_not:
        try:
            priorities_not = [Priority(p.strip()) for p in priority_not.split(",") if p.strip()]
        except ValueError:
            pass

    parsed_tag_ids: list[UUID] | None = None
    if tag_ids:
        try:
            parsed_tag_ids = [UUID(t.strip()) for t in tag_ids.split(",") if t.strip()]
        except ValueError:
            pass

    tasks, total = await service.list_for_project(
        project_id,
        user_id=current_user.id,
        list_id=list_id,
        priority=priority,
        priorities_not=priorities_not,
        assignee_id=assignee_id,
        tag_ids=parsed_tag_ids,
        include_subtasks=include_subtasks,
        page=page,
        page_size=page_size,
        sort_by=sort_by,
        sort_dir=sort_dir,
    )
    response.headers["X-Total-Count"] = str(total)
    return await _build_task_responses(tasks, tag_repo)


@router.get("/projects/{project_id}/analytics", response_model=AnalyticsResponse)
async def get_project_analytics(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    project_repo = ProjectRepository(session)
    project = await project_repo.get_by_id(project_id)
    if not project:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Project not found")

    workspace_repo = WorkspaceRepository(session)
    member = await workspace_repo.get_member(project.workspace_id, current_user.id)
    if not member:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Not a workspace member")

    task_repo = TaskRepository(session)
    list_repo = ListRepository(session)

    data = await task_repo.analytics_for_project(project_id)

    status_ids = [row["status_id"] for row in data["by_status"] if row["status_id"] is not None]
    status_name_map: dict = {}
    for sid in status_ids:
        s = await list_repo.get_status_by_id(sid)
        if s:
            status_name_map[str(sid)] = s.name

    tasks_by_status = [
        StatusCount(
            status_id=row["status_id"],
            status_name=status_name_map.get(str(row["status_id"])) if row["status_id"] else None,
            count=row["count"],
            story_points=row["story_points"],
        )
        for row in data["by_status"]
    ]

    return AnalyticsResponse(
        total_tasks=data["total"],
        overdue_tasks=data["overdue"],
        total_story_points=data["total_story_points"],
        tasks_by_status=tasks_by_status,
    )


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
    tag_repo: TagRepository = Depends(get_tag_repo),
):
    task = await service.get_or_404_for_user(task_id, current_user.id)
    responses = await _build_task_responses([task], tag_repo)
    return responses[0]


@router.get("/tasks/{task_id}/subtasks", response_model=list[TaskResponse])
async def list_subtasks(
    task_id: UUID,
    current_user: User = Depends(get_current_user),
    service: TaskService = Depends(get_service),
    tag_repo: TagRepository = Depends(get_tag_repo),
):
    subtasks = await service.list_subtasks(task_id, user_id=current_user.id)
    return await _build_task_responses(subtasks, tag_repo)


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
    background_tasks: BackgroundTasks,
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
    ws_repo = WorkspaceRepository(session)
    task_url = f"{settings.frontend_url}/tasks/{task_id}"

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
                user = await ws_repo.get_user_by_id(UUID(uid_str))
                if user and user.email and user.notification_preference == "immediate":
                    background_tasks.add_task(
                        send_email,
                        to=user.email,
                        subject=f"You were assigned to \"{task.title}\"",
                        html=assignment_email(current_user.display_name, task.title, task_url),
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
            user = await ws_repo.get_user_by_id(watcher_id)
            if user and user.email and user.notification_preference == "immediate":
                background_tasks.add_task(
                    send_email,
                    to=user.email,
                    subject=f"\"{task.title}\" was updated",
                    html=watcher_update_email(task.title, "task", task_url),
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
    tag_repo: TagRepository = Depends(get_tag_repo),
):
    tasks = await service.list_my_tasks(
        workspace_id,
        user_id=current_user.id,
        status_id=status_id,
        priority=priority,
    )
    return await _build_task_responses(tasks, tag_repo)


@router.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    task_id: UUID,
    current_user: User = Depends(get_current_user),
    service: TaskService = Depends(get_service),
    session: AsyncSession = Depends(get_session),
):
    await service.delete(task_id, actor_id=current_user.id)
    await session.commit()


async def _time_map(session: AsyncSession, task_ids: list[UUID]) -> dict[str, int]:
    """Return {task_id_str: total_minutes} for all given task IDs."""
    if not task_ids:
        return {}
    rows = await session.execute(
        select(TimeEntry.task_id, func.sum(TimeEntry.duration_minutes).label("total"))
        .where(TimeEntry.task_id.in_(task_ids))
        .group_by(TimeEntry.task_id)
    )
    return {str(r.task_id): r.total for r in rows}


async def _cf_data(session: AsyncSession, list_ids: list[UUID], task_ids: list[UUID]):
    """Return (field_defs ordered, {task_id_str: {field_id_str: display_value}})."""
    if not list_ids or not task_ids:
        return [], {}

    defs_result = await session.execute(
        select(CustomFieldDefinition)
        .where(CustomFieldDefinition.list_id.in_(list_ids))
        .where(CustomFieldDefinition.deleted_at.is_(None))
        .order_by(CustomFieldDefinition.order_index)
    )
    field_defs = defs_result.scalars().all()

    if not field_defs:
        return [], {}

    field_ids = [f.id for f in field_defs]
    vals_result = await session.execute(
        select(CustomFieldValue)
        .where(CustomFieldValue.task_id.in_(task_ids))
        .where(CustomFieldValue.field_id.in_(field_ids))
    )
    values = vals_result.scalars().all()

    task_cf: dict[str, dict[str, str]] = {}
    for v in values:
        tid = str(v.task_id)
        fid = str(v.field_id)
        if v.value_text is not None:
            display = v.value_text
        elif v.value_number is not None:
            display = str(v.value_number)
        elif v.value_boolean is not None:
            display = "true" if v.value_boolean else "false"
        elif v.value_date is not None:
            display = v.value_date.date().isoformat()
        elif v.value_json is not None:
            display = v.value_json.get("selected", "") if isinstance(v.value_json, dict) else ""
        else:
            display = ""
        task_cf.setdefault(tid, {})[fid] = display

    return list(field_defs), task_cf


def _csv_response(rows: list[list], filename: str) -> StreamingResponse:
    output = io.StringIO()
    output.write("\ufeff")  # UTF-8 BOM for Excel compatibility
    writer = csv.writer(output)
    for row in rows:
        writer.writerow(row)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv; charset=utf-8-sig",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/lists/{list_id}/tasks/export")
async def export_tasks_csv(
    request: Request,
    list_id: UUID,
    status_id: UUID | None = None,
    status_id_not: str | None = None,
    priority: Priority | None = None,
    priority_not: str | None = None,
    assignee_id: UUID | None = None,
    include_subtasks: bool = True,
    current_user: User = Depends(get_current_user),
    service: TaskService = Depends(get_service),
    session: AsyncSession = Depends(get_session),
):
    # Parse cf[] filters
    cf_filters: dict[UUID, str] = {}
    for key, value in request.query_params.items():
        if key.startswith("cf[") and key.endswith("]"):
            try:
                cf_filters[UUID(key[3:-1])] = value
            except ValueError:
                pass

    status_ids_not: list[UUID] | None = None
    if status_id_not:
        try:
            status_ids_not = [UUID(s.strip()) for s in status_id_not.split(",") if s.strip()]
        except ValueError:
            pass

    priorities_not: list[Priority] | None = None
    if priority_not:
        try:
            priorities_not = [Priority(p.strip()) for p in priority_not.split(",") if p.strip()]
        except ValueError:
            pass

    tasks, _ = await service.list_for_list(
        list_id,
        user_id=current_user.id,
        status_id=status_id,
        status_ids_not=status_ids_not,
        priority=priority,
        priorities_not=priorities_not,
        assignee_id=assignee_id,
        cf_filters=cf_filters if cf_filters else None,
        include_subtasks=include_subtasks,
        page=1,
        page_size=0,
    )

    list_repo = ListRepository(session)
    lst = await list_repo.get_by_id(list_id)
    statuses = await list_repo.list_statuses(list_id)
    status_map = {str(s.id): s.name for s in statuses}

    workspace_repo = WorkspaceRepository(session)
    workspace_id = tasks[0].workspace_id if tasks else (lst.workspace_id if lst else None)
    member_map: dict[str, str] = {}
    if workspace_id:
        members = await workspace_repo.list_member_users(workspace_id)
        member_map = {str(m.id): m.display_name for m in members}

    task_ids = [t.id for t in tasks]
    time_map = await _time_map(session, task_ids)

    # Epic names
    epic_ids = list({t.epic_id for t in tasks if t.epic_id})
    epic_name_map: dict[str, str] = {}
    if epic_ids:
        epic_rows = await session.execute(select(Epic).where(Epic.id.in_(epic_ids)))
        for e in epic_rows.scalars():
            epic_name_map[str(e.id)] = e.name

    field_defs, task_cf = await _cf_data(session, [list_id], task_ids)
    cf_headers = [f.name for f in field_defs]
    cf_field_ids = [str(f.id) for f in field_defs]

    list_name = lst.name if lst else ""
    filename = f"{list_name.lower().replace(' ', '-')}-tasks-{date.today().isoformat()}.csv"

    header = ["task_key", "title", "list", "status", "priority", "assignees", "reporter",
              "start_date", "due_date", "story_points", "time_tracked_min", "epic"] + cf_headers
    rows = [header]
    for task in tasks:
        status_name = status_map.get(str(task.status_id), "") if task.status_id else ""
        assignees = ", ".join(member_map.get(str(aid), str(aid)) for aid in task.assignee_ids)
        reporter = member_map.get(str(task.reporter_id), str(task.reporter_id))
        cf_vals = [task_cf.get(str(task.id), {}).get(fid, "") for fid in cf_field_ids]
        rows.append([
            task.task_key or "",
            task.title,
            list_name,
            status_name,
            task.priority.value if hasattr(task.priority, "value") else str(task.priority),
            assignees,
            reporter,
            task.start_date.date().isoformat() if task.start_date else "",
            task.due_date.date().isoformat() if task.due_date else "",
            task.story_points if task.story_points is not None else "",
            time_map.get(str(task.id), 0) or "",
            epic_name_map.get(str(task.epic_id), "") if task.epic_id else "",
            *cf_vals,
        ])
    return _csv_response(rows, filename)


@router.get("/projects/{project_id}/tasks/export")
async def export_project_tasks_csv(
    project_id: UUID,
    list_id: UUID | None = None,
    priority: Priority | None = None,
    priority_not: str | None = None,
    assignee_id: UUID | None = None,
    include_subtasks: bool = True,
    current_user: User = Depends(get_current_user),
    service: TaskService = Depends(get_service),
    session: AsyncSession = Depends(get_session),
):
    priorities_not: list[Priority] | None = None
    if priority_not:
        try:
            priorities_not = [Priority(p.strip()) for p in priority_not.split(",") if p.strip()]
        except ValueError:
            pass

    tasks, _ = await service.list_for_project(
        project_id,
        user_id=current_user.id,
        list_id=list_id,
        priority=priority,
        priorities_not=priorities_not,
        assignee_id=assignee_id,
        include_subtasks=include_subtasks,
        page=1,
        page_size=0,
    )

    list_repo = ListRepository(session)
    all_lists = await list_repo.list_for_project(project_id)
    status_map: dict[str, str] = {}
    list_name_map: dict[str, str] = {}
    for lst in all_lists:
        list_name_map[str(lst.id)] = lst.name
        statuses = await list_repo.list_statuses(lst.id)
        for s in statuses:
            status_map[str(s.id)] = s.name

    workspace_repo = WorkspaceRepository(session)
    project_repo = ProjectRepository(session)
    project = await project_repo.get_by_id(project_id)
    member_map: dict[str, str] = {}
    if project:
        members = await workspace_repo.list_member_users(project.workspace_id)
        member_map = {str(m.id): m.display_name for m in members}

    task_ids = [t.id for t in tasks]
    time_map = await _time_map(session, task_ids)

    # Epic names
    epic_ids = list({t.epic_id for t in tasks if t.epic_id})
    epic_name_map: dict[str, str] = {}
    if epic_ids:
        epic_rows = await session.execute(select(Epic).where(Epic.id.in_(epic_ids)))
        for e in epic_rows.scalars():
            epic_name_map[str(e.id)] = e.name

    list_ids = [lst.id for lst in all_lists]
    field_defs, task_cf = await _cf_data(session, list_ids, task_ids)
    cf_headers = [f.name for f in field_defs]
    cf_field_ids = [str(f.id) for f in field_defs]

    prefix = project.task_prefix.lower() if project else "tasks"
    filename = f"{prefix}-tasks-{date.today().isoformat()}.csv"

    header = ["task_key", "title", "list", "status", "priority", "assignees", "reporter",
              "start_date", "due_date", "story_points", "time_tracked_min", "epic"] + cf_headers
    rows = [header]
    for task in tasks:
        status_name = status_map.get(str(task.status_id), "") if task.status_id else ""
        list_name = list_name_map.get(str(task.list_id), "") if task.list_id else ""
        assignees = ", ".join(member_map.get(str(aid), str(aid)) for aid in task.assignee_ids)
        reporter = member_map.get(str(task.reporter_id), str(task.reporter_id))
        cf_vals = [task_cf.get(str(task.id), {}).get(fid, "") for fid in cf_field_ids]
        rows.append([
            task.task_key or "",
            task.title,
            list_name,
            status_name,
            task.priority.value if hasattr(task.priority, "value") else str(task.priority),
            assignees,
            reporter,
            task.start_date.date().isoformat() if task.start_date else "",
            task.due_date.date().isoformat() if task.due_date else "",
            task.story_points if task.story_points is not None else "",
            time_map.get(str(task.id), 0) or "",
            epic_name_map.get(str(task.epic_id), "") if task.epic_id else "",
            *cf_vals,
        ])
    return _csv_response(rows, filename)


@router.get("/workspaces/{workspace_id}/search", response_model=list[TaskSearchResult])
async def search_tasks(
    workspace_id: UUID,
    q: str = "",
    current_user: User = Depends(get_current_user),
    service: TaskService = Depends(get_service),
    session: AsyncSession = Depends(get_session),
):
    from sqlalchemy import select as sa_select
    from app.models.list_ import List as ListModel
    from app.models.project import Project as ProjectModel

    if len(q) < 2:
        return []
    tasks = await service.search(workspace_id, q, actor_id=current_user.id)

    # Bulk-fetch list and project names for enrichment
    unique_list_ids = {t.list_id for t in tasks if t.list_id}
    unique_project_ids = {t.project_id for t in tasks}

    list_names: dict = {}
    if unique_list_ids:
        rows = await session.execute(
            sa_select(ListModel.id, ListModel.name).where(ListModel.id.in_(unique_list_ids))
        )
        list_names = {row.id: row.name for row in rows}

    project_names: dict = {}
    if unique_project_ids:
        rows = await session.execute(
            sa_select(ProjectModel.id, ProjectModel.name).where(ProjectModel.id.in_(unique_project_ids))
        )
        project_names = {row.id: row.name for row in rows}

    return [
        TaskSearchResult(
            **TaskResponse.model_validate(t).model_dump(),
            list_name=list_names.get(t.list_id) if t.list_id else None,
            project_name=project_names.get(t.project_id),
        )
        for t in tasks
    ]


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
        set_epic='epic_id' in body.model_fields_set,
        epic_id=body.epic_id,
    )
    await session.commit()
    return BulkOperationResponse(updated=updated)


@router.post("/tasks/bulk-move", response_model=BulkOperationResponse)
async def bulk_move_tasks(
    body: BulkMoveRequest,
    current_user: User = Depends(get_current_user),
    service: TaskService = Depends(get_service),
    session: AsyncSession = Depends(get_session),
):
    moved = await service.bulk_move(
        task_ids=body.task_ids,
        list_id=body.list_id,
        actor_id=current_user.id,
    )
    await session.commit()
    return BulkOperationResponse(updated=moved)


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


@router.get("/tasks/{task_id}/git-links", response_model=list[TaskGitLinkResponse])
async def list_task_git_links(
    task_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    repo = GitLinkRepository(session)
    return await repo.list_for_task(task_id)
