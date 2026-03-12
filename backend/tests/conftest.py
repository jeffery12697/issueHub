"""
Test fixtures.

Tables are created once (sync, before any test) then truncated between tests.
Each test gets its own async engine + session to avoid event-loop conflicts.

Run with:
    docker compose exec backend pytest
"""
import asyncio
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from app.core.config import settings
from app.core.database import get_session
from app.core.security import create_access_token
from app.main import app as fastapi_app
from app.models.base import Base
from app.models.user import User
from app.models.workspace import Workspace, WorkspaceMember, WorkspaceRole
from app.models.project import Project
from app.models.list_ import List
import app.models.audit_log  # noqa — register with metadata
import app.models.task_dependency  # noqa
import app.models.task  # noqa
import app.models.comment  # noqa
import app.models.custom_field  # noqa
import app.models.list_template  # noqa

_base_url = settings.database_url.rsplit("/", 1)[0]
TEST_DATABASE_URL = f"{_base_url}/issuehub_test"

_TRUNCATE_ORDER = [
    "comments",
    "audit_logs",
    "task_dependencies",
    "custom_field_values",
    "custom_field_definitions",
    "list_templates",
    "tasks",
    "list_statuses",
    "lists",
    "projects",
    "workspace_members",
    "workspaces",
    "users",
]


# ── one-time sync setup ───────────────────────────────────────────────────────

@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    """Create schema once before all tests, drop after."""
    async def _create():
        eng = create_async_engine(TEST_DATABASE_URL)
        async with eng.begin() as conn:
            await conn.execute(text("CREATE EXTENSION IF NOT EXISTS ltree"))
            await conn.run_sync(Base.metadata.create_all)
        await eng.dispose()

    async def _drop():
        eng = create_async_engine(TEST_DATABASE_URL)
        async with eng.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
        await eng.dispose()

    asyncio.run(_create())
    yield
    asyncio.run(_drop())


# ── per-test fixtures ─────────────────────────────────────────────────────────

@pytest.fixture
async def db():
    """Session per test; tables truncated after each test."""
    eng = create_async_engine(TEST_DATABASE_URL)
    factory = async_sessionmaker(eng, expire_on_commit=False)
    async with factory() as session:
        yield session
    async with eng.begin() as conn:
        for table in _TRUNCATE_ORDER:
            await conn.execute(text(f'TRUNCATE TABLE "{table}" CASCADE'))
    await eng.dispose()


@pytest.fixture
async def client(db):
    async def override_get_session():
        yield db

    fastapi_app.dependency_overrides[get_session] = override_get_session
    async with AsyncClient(transport=ASGITransport(app=fastapi_app), base_url="http://test") as c:
        yield c
    fastapi_app.dependency_overrides.clear()


# ── helpers ───────────────────────────────────────────────────────────────────

async def make_user(db: AsyncSession, email: str = "user@example.com") -> User:
    user = User(email=email, display_name=email.split("@")[0])
    db.add(user)
    await db.flush()
    return user


async def make_workspace(db: AsyncSession, owner: User, name: str = "My Workspace") -> Workspace:
    ws = Workspace(name=name)
    db.add(ws)
    await db.flush()
    db.add(WorkspaceMember(workspace_id=ws.id, user_id=owner.id, role=WorkspaceRole.owner))
    await db.flush()
    return ws


async def make_project(db: AsyncSession, workspace: Workspace, name: str = "My Project") -> Project:
    p = Project(workspace_id=workspace.id, name=name)
    db.add(p)
    await db.flush()
    return p


async def make_list(db: AsyncSession, project: Project, name: str = "My List") -> List:
    l = List(project_id=project.id, name=name)
    db.add(l)
    await db.flush()
    return l


def auth_headers(user: User) -> dict:
    return {"Authorization": f"Bearer {create_access_token(user.id)}"}


# ── shared fixtures ───────────────────────────────────────────────────────────

@pytest.fixture
async def user(db):
    return await make_user(db)


@pytest.fixture
async def workspace(db, user):
    return await make_workspace(db, user)


@pytest.fixture
async def project(db, workspace):
    return await make_project(db, workspace)


@pytest.fixture
async def list_(db, project):
    return await make_list(db, project)


@pytest.fixture
def headers(user):
    return auth_headers(user)
