# Project Structure & Code Examples

Full folder tree, Request → DTO → Repository flow examples, and test structure.
Read this when implementing — not needed for understanding rules (see `CLAUDE.md`).

---

## Project Root

```
issueHub/
├── backend/                  # FastAPI root
│   ├── app/
│   ├── alembic/
│   ├── tests/
│   └── requirements.txt
│
├── frontend/                 # React + Vite SPA root
│   ├── src/
│   ├── index.html
│   ├── vite.config.ts
│   └── tsconfig.json
│
├── docs/
│   └── stories/
├── docker-compose.yml
├── CLAUDE.md
└── PROGRESS.md
```

---

## Backend: Feature-First Folder Structure

```
backend/app/
├── features/
│   ├── auth/
│   │   ├── router.py
│   │   ├── service.py
│   │   └── schemas.py
│   │
│   ├── workspaces/
│   │   ├── router.py
│   │   ├── service.py
│   │   ├── repository.py
│   │   └── schemas.py
│   │
│   ├── projects/
│   │   ├── router.py
│   │   ├── service.py
│   │   ├── repository.py
│   │   └── schemas.py
│   │
│   ├── lists/                          # List + status management
│   │   ├── router.py
│   │   ├── service.py
│   │   ├── repository.py
│   │   └── schemas.py
│   │
│   ├── tasks/
│   │   ├── router.py                   # thin route handlers
│   │   ├── service.py                  # business logic, dispatches BackgroundTasks
│   │   ├── repository.py               # ALL SQLAlchemy queries
│   │   └── schemas.py                  # DTOs (frozen dataclasses) + response schemas
│   │
│   ├── custom_fields/
│   │   ├── router.py
│   │   ├── service.py
│   │   ├── repository.py
│   │   └── schemas.py
│   │
│   ├── audit/
│   │   ├── service.py                  # audit writer (called as BackgroundTask)
│   │   ├── repository.py
│   │   └── schemas.py
│   │
│   ├── comments/
│   │   ├── router.py
│   │   ├── service.py
│   │   ├── repository.py
│   │   └── schemas.py
│   │
│   ├── attachments/
│   │   ├── router.py
│   │   ├── service.py
│   │   ├── repository.py
│   │   └── schemas.py
│   │
│   └── templates/
│       ├── router.py
│       ├── service.py
│       ├── repository.py
│       └── schemas.py
│
├── models/                             # Shared SQLAlchemy models (cross-feature type hints)
│   ├── base.py                         # DeclarativeBase + SoftDeleteMixin
│   ├── task.py                         # ltree path, self-ref FK
│   ├── audit_log.py                    # append-only, monthly partitioned
│   ├── user.py
│   ├── workspace.py
│   ├── project.py
│   ├── list_.py
│   ├── list_status.py
│   ├── status_mapping.py
│   ├── task_dependency.py
│   ├── custom_field.py
│   ├── comment.py
│   ├── attachment.py
│   └── list_template.py
│
├── core/
│   ├── config.py                       # Settings (env vars via pydantic-settings)
│   ├── security.py                     # JWT encode/decode helpers
│   ├── database.py                     # Async engine + session factory
│   ├── redis.py                        # Redis async client
│   └── ws_manager.py                   # WebSocket + Redis Pub/Sub bridge
│
└── main.py                             # App factory, router registration
```

---

## Code Examples: Request → DTO → Repository Flow

### 1. Request Schema — validates raw HTTP input, exposes `.to_dto()`

```python
# app/features/tasks/schemas.py

from pydantic import BaseModel, field_validator
from uuid import UUID
from app.models.task import Priority

class CreateTaskRequest(BaseModel):
    title: str
    list_id: UUID
    priority: Priority = Priority.none
    description: str | None = None
    assignee_ids: list[UUID] = []
    due_date: datetime | None = None

    @field_validator("title")
    @classmethod
    def title_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("title cannot be blank")
        return v.strip()

    def to_dto(self, reporter_id: UUID) -> "CreateTaskDTO":
        return CreateTaskDTO(
            title=self.title,
            list_id=self.list_id,
            priority=self.priority,
            description=self.description,
            assignee_ids=tuple(self.assignee_ids),
            due_date=self.due_date,
            reporter_id=reporter_id,
        )
```

### 2. DTO — frozen dataclass (immutable, no interface)

```python
# app/features/tasks/schemas.py (continued)

from dataclasses import dataclass
from uuid import UUID
from datetime import datetime

@dataclass(frozen=True)
class CreateTaskDTO:
    title: str
    list_id: UUID
    priority: Priority
    reporter_id: UUID
    description: str | None = None
    assignee_ids: tuple[UUID, ...] = ()
    due_date: datetime | None = None
```

### 3. Repository — all SQLAlchemy queries live here

```python
# app/features/tasks/repository.py

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.task import Task
from app.features.tasks.schemas import CreateTaskDTO

class TaskRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, dto: CreateTaskDTO, path: str) -> Task:
        task = Task(
            title=dto.title,
            list_id=dto.list_id,
            priority=dto.priority,
            description=dto.description,
            assignee_ids=list(dto.assignee_ids),
            due_date=dto.due_date,
            reporter_id=dto.reporter_id,
            path=path,
        )
        self.session.add(task)
        await self.session.flush()
        return task

    async def get_tree(self, root_id: UUID) -> list[Task]:
        result = await self.session.execute(
            select(Task)
            .where(Task.path.op("<@")(str(root_id)))
            .where(Task.deleted_at.is_(None))
            .order_by(Task.path)
        )
        return result.scalars().all()

    async def get_by_id(self, task_id: UUID) -> Task | None:
        result = await self.session.execute(
            select(Task)
            .where(Task.id == task_id)
            .where(Task.deleted_at.is_(None))
        )
        return result.scalar_one_or_none()
```

### 4. Service — orchestrates repo + business rules, dispatches BackgroundTasks

```python
# app/features/tasks/service.py

from uuid import UUID
from fastapi import BackgroundTasks
from app.features.tasks.repository import TaskRepository
from app.features.tasks.schemas import CreateTaskDTO
from app.features.audit.service import AuditService
from app.models.task import Task

class TaskService:
    def __init__(self, repo: TaskRepository, audit: AuditService):
        self.repo = repo
        self.audit = audit

    async def create_task(
        self,
        dto: CreateTaskDTO,
        background_tasks: BackgroundTasks,
    ) -> Task:
        path = str(dto.list_id)  # root task: path = own id (set after flush)
        task = await self.repo.create(dto, path=path)

        # Update path to task's own id now that we have it
        task.path = str(task.id)

        background_tasks.add_task(
            self.audit.record,
            task_id=task.id,
            actor_id=dto.reporter_id,
            action="created",
        )
        return task
```

### 5. Route Handler — thin, just wiring

```python
# app/features/tasks/router.py

from fastapi import APIRouter, Depends, BackgroundTasks, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_session
from app.core.security import get_current_user
from app.features.tasks.schemas import CreateTaskRequest, TaskResponse
from app.features.tasks.service import TaskService
from app.features.tasks.repository import TaskRepository
from app.features.audit.service import AuditService
from app.models.user import User

router = APIRouter(prefix="/tasks", tags=["tasks"])

def get_task_service(session: AsyncSession = Depends(get_session)) -> TaskService:
    return TaskService(
        repo=TaskRepository(session),
        audit=AuditService(session),
    )

@router.post("", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(
    body: CreateTaskRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    service: TaskService = Depends(get_task_service),
):
    task = await service.create_task(
        dto=body.to_dto(reporter_id=current_user.id),
        background_tasks=background_tasks,
    )
    return TaskResponse.model_validate(task)
```

### 6. Cross-Feature Dependencies — import the concrete repository

```python
# Payroll needs workspace member data — import concrete repository, not the model directly
from app.features.workspaces.repository import WorkspaceMemberRepository

class PayrollService:
    def __init__(
        self,
        members: WorkspaceMemberRepository,
        pay_runs: PayRunRepository,
    ):
        self.members = members
        self.pay_runs = pay_runs

# The model class (WorkspaceMember) can still be used for type hints and
# relationship definitions — the constraint is: no queries outside repositories.
```

---

## Test Structure

```
backend/tests/
├── conftest.py                              # async session, test client, fixtures
├── unit/
│   └── features/
│       ├── tasks/
│       │   ├── test_task_repository.py      # real DB, test queries
│       │   └── test_task_service.py         # mocked repo, test business logic
│       ├── custom_fields/
│       │   └── test_field_service.py        # mocked repo, test validation logic
│       └── audit/
│           └── test_audit_service.py        # mocked repo, no DB
└── integration/
    └── features/
        ├── tasks/
        │   └── test_task_api.py             # real HTTP, real DB
        └── auth/
            └── test_auth_api.py
```

### Repository test — real DB, transaction rolled back after each test

```python
# tests/unit/features/tasks/test_task_repository.py

import pytest
from app.features.tasks.repository import TaskRepository
from app.features.tasks.schemas import CreateTaskDTO
from app.models.task import Priority

@pytest.mark.asyncio
async def test_create_task(db_session, workspace, list_):
    repo = TaskRepository(db_session)

    dto = CreateTaskDTO(
        title="Fix login bug",
        list_id=list_.id,
        priority=Priority.high,
        reporter_id=workspace.owner_id,
    )

    task = await repo.create(dto, path=str(dto.list_id))

    assert task.id is not None
    assert task.title == "Fix login bug"
    assert task.deleted_at is None
```

### Service test — mocked repository, no DB

```python
# tests/unit/features/tasks/test_task_service.py

import pytest
from unittest.mock import AsyncMock
from fastapi import BackgroundTasks
from app.features.tasks.service import TaskService
from app.features.tasks.schemas import CreateTaskDTO
from app.models.task import Priority

@pytest.mark.asyncio
async def test_create_task_dispatches_audit():
    mock_repo = AsyncMock()
    mock_audit = AsyncMock()
    mock_repo.create.return_value = AsyncMock(id=uuid4(), path="")

    service = TaskService(repo=mock_repo, audit=mock_audit)
    bg = BackgroundTasks()

    dto = CreateTaskDTO(
        title="New task",
        list_id=uuid4(),
        priority=Priority.medium,
        reporter_id=uuid4(),
    )

    await service.create_task(dto, background_tasks=bg)

    mock_repo.create.assert_called_once()
    assert len(bg.tasks) == 1  # audit dispatched
```

### Integration test — real HTTP, real DB

```python
# tests/integration/features/tasks/test_task_api.py

import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_create_task_returns_201(client: AsyncClient, auth_headers, list_):
    response = await client.post(
        "/api/v1/tasks",
        json={"title": "New task", "list_id": str(list_.id), "priority": "high"},
        headers=auth_headers,
    )

    assert response.status_code == 201
    assert response.json()["title"] == "New task"
```
