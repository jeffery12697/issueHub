from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.security import get_current_user
from app.features.dependencies.repository import DependencyRepository
from app.features.tasks.repository import TaskRepository
from app.features.tasks.schemas import TaskResponse
from app.models.user import User

router = APIRouter(tags=["dependencies"])


class AddDependencyRequest(BaseModel):
    depends_on_id: UUID


@router.get("/tasks/{task_id}/blocked-by", response_model=list[TaskResponse])
async def get_blocked_by(
    task_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    repo = DependencyRepository(session)
    tasks = await repo.get_blocked_by(task_id)
    return [TaskResponse.model_validate(t) for t in tasks]


@router.get("/tasks/{task_id}/blocking", response_model=list[TaskResponse])
async def get_blocking(
    task_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    repo = DependencyRepository(session)
    tasks = await repo.get_blocking(task_id)
    return [TaskResponse.model_validate(t) for t in tasks]


@router.post("/tasks/{task_id}/blocked-by", status_code=status.HTTP_201_CREATED)
async def add_dependency(
    task_id: UUID,
    body: AddDependencyRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    if task_id == body.depends_on_id:
        raise HTTPException(status_code=400, detail="A task cannot depend on itself")

    dep_repo = DependencyRepository(session)

    # Prevent circular: check if depends_on_id is already blocked by task_id
    if await dep_repo.exists(body.depends_on_id, task_id):
        raise HTTPException(status_code=400, detail="Circular dependency detected")

    if await dep_repo.exists(task_id, body.depends_on_id):
        raise HTTPException(status_code=400, detail="Dependency already exists")

    await dep_repo.add(task_id, body.depends_on_id)
    await session.commit()
    return {"ok": True}


@router.delete("/tasks/{task_id}/blocked-by/{depends_on_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_dependency(
    task_id: UUID,
    depends_on_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    repo = DependencyRepository(session)
    await repo.remove(task_id, depends_on_id)
    await session.commit()
