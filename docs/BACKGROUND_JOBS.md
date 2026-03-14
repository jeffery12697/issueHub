# Background Jobs — Design Plan

## Overview

Scheduled jobs run periodic tasks on a timer inside the FastAPI process using **APScheduler**. No extra Docker services required — the scheduler runs in the same asyncio event loop as Uvicorn.

Current jobs planned:

| Job | Schedule | Story |
|-----|----------|-------|
| `check_overdue_tasks` | Daily at 08:00 Asia/Taipei | AU-02 |
| `send_notification_digest` | Daily at 08:00 Asia/Taipei | N-02 |

---

## Library

```bash
pip install "apscheduler>=3.10"
```

`AsyncIOScheduler` integrates natively with `asyncio` — jobs are coroutines, no thread pool needed.

---

## New module: `app/core/scheduler.py`

Single shared scheduler instance:

```python
from apscheduler.schedulers.asyncio import AsyncIOScheduler

scheduler = AsyncIOScheduler(timezone="Asia/Taipei")
```

---

## Register in lifespan (`app/main.py`)

Add alongside the existing `redis_listener` task:

```python
from app.core.scheduler import scheduler
from app.jobs.overdue import check_overdue_tasks
from app.jobs.digest import send_notification_digest

@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler.add_job(check_overdue_tasks, "cron", hour=8, minute=0)
    scheduler.add_job(send_notification_digest, "cron", hour=8, minute=0)
    scheduler.start()

    redis_task = asyncio.create_task(redis_listener())
    yield

    scheduler.shutdown(wait=False)
    redis_task.cancel()
    try:
        await redis_task
    except (asyncio.CancelledError, Exception):
        pass
```

---

## Job structure

```
app/jobs/
  __init__.py
  overdue.py        # AU-02: scan overdue tasks, email assignees once
  digest.py         # N-02: daily notification digest email
```

---

## `app/jobs/overdue.py` (AU-02)

```python
from app.core.database import AsyncSessionLocal
from app.core.email import send_email
from app.core.email_templates import overdue_email
from app.features.tasks.repository import TaskRepository
from app.features.workspaces.repository import WorkspaceRepository

async def check_overdue_tasks() -> None:
    """Daily: find tasks that just became overdue and email each assignee once."""
    async with AsyncSessionLocal() as session:
        task_repo = TaskRepository(session)
        ws_repo = WorkspaceRepository(session)

        overdue = await task_repo.get_newly_overdue()
        # returns tasks where due_date < today (Asia/Taipei) AND overdue_notified IS FALSE

        for task in overdue:
            for user_id in task.assignee_ids:
                user = await ws_repo.get_user(user_id)
                if user and user.email:
                    await send_email(
                        to=user.email,
                        subject=f"Overdue: {task.title}",
                        html=overdue_email(
                            task.title,
                            f"{settings.frontend_url}/tasks/{task.id}",
                            str(task.due_date.date()),
                        ),
                    )
            await task_repo.mark_overdue_notified(task.id)

        await session.commit()
```

### Required DB change

Add `overdue_notified: bool` (default `False`) to the `tasks` table to prevent re-sending every day.

- Reset to `False` whenever `due_date` is updated (handled in `TaskRepository.update`)
- Migration: `0017_add_overdue_notified.py`

New repository methods needed:

```python
# TaskRepository
async def get_newly_overdue(self) -> list[Task]:
    # WHERE due_date < now('Asia/Taipei') AND overdue_notified = false AND deleted_at IS NULL

async def mark_overdue_notified(self, task_id: UUID) -> None:
    # UPDATE tasks SET overdue_notified = true WHERE id = task_id
```

---

## `app/jobs/digest.py` (N-02)

```python
from app.core.database import AsyncSessionLocal
from app.core.email import send_email
from app.core.email_templates import digest_email
from app.features.notifications.repository import NotificationRepository
from app.features.workspaces.repository import WorkspaceRepository

async def send_notification_digest() -> None:
    """Daily: email each user their unread notifications from the past 24 hours."""
    async with AsyncSessionLocal() as session:
        notif_repo = NotificationRepository(session)
        ws_repo = WorkspaceRepository(session)

        unread_by_user = await notif_repo.get_unread_grouped_by_user(since_hours=24)
        # returns dict[UUID, list[Notification]]

        for user_id, notifications in unread_by_user.items():
            user = await ws_repo.get_user(user_id)
            if user and user.email and notifications:
                await send_email(
                    to=user.email,
                    subject=f"IssueHub — {len(notifications)} update{'s' if len(notifications) > 1 else ''}",
                    html=digest_email(notifications),
                )
```

New repository method needed:

```python
# NotificationRepository
async def get_unread_grouped_by_user(self, since_hours: int) -> dict[UUID, list[Notification]]:
    # WHERE is_read = false AND created_at >= now() - interval '{since_hours} hours'
    # GROUP by user_id in Python
```

---

## Trigger types comparison

| Trigger | When to use | Example |
|---------|------------|---------|
| `"cron"` | Fixed time of day | Daily digest at 08:00 |
| `"interval"` | Every N seconds/minutes | Check overdue every hour |
| `"date"` | One-shot at a specific datetime | Send a reminder at a user-set time |

---

## Key Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Scheduler | APScheduler `AsyncIOScheduler` | In-process, asyncio-native, no extra Docker service |
| Job isolation | Each job opens its own `AsyncSessionLocal` session | Avoids session sharing across the event loop |
| Duplicate prevention | `overdue_notified` flag on task | Simple and reliable; resets on due date change |
| Timezone | Asia/Taipei for all schedules | Project convention |
