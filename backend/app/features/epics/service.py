from uuid import UUID

from fastapi import HTTPException, status

from app.features.epics.repository import EpicRepository
from app.features.epics.schemas import CreateEpicRequest, UpdateEpicDTO, EpicResponse
from app.features.projects.repository import ProjectRepository
from app.features.workspaces.repository import WorkspaceRepository
from app.models.epic import Epic
from app.models.task import Task


class EpicService:
    def __init__(
        self,
        repo: EpicRepository,
        project_repo: ProjectRepository,
        workspace_repo: WorkspaceRepository,
    ):
        self.repo = repo
        self.project_repo = project_repo
        self.workspace_repo = workspace_repo

    async def create(self, project_id: UUID, body: CreateEpicRequest, created_by: UUID) -> Epic:
        project = await self.project_repo.get_by_id(project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        await self._require_member(project.workspace_id, created_by)
        return await self.repo.create(body.to_dto(project_id=project_id, workspace_id=project.workspace_id, created_by=created_by))

    async def get_or_404(self, epic_id: UUID) -> Epic:
        epic = await self.repo.get_by_id(epic_id)
        if not epic:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Epic not found")
        return epic

    async def list_for_project(self, project_id: UUID, user_id: UUID) -> list[EpicResponse]:
        project = await self.project_repo.get_by_id(project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        await self._require_member(project.workspace_id, user_id)
        epics = await self.repo.list_for_project(project_id)
        result = []
        for epic in epics:
            total, done = await self.repo.task_counts(epic.id)
            r = EpicResponse.model_validate(epic)
            result.append(r.model_copy(update={"task_count": total, "done_count": done}))
        return result

    async def get_with_counts(self, epic_id: UUID, user_id: UUID) -> EpicResponse:
        epic = await self.get_or_404(epic_id)
        await self._require_member(epic.workspace_id, user_id)
        total, done = await self.repo.task_counts(epic.id)
        r = EpicResponse.model_validate(epic)
        return r.model_copy(update={"task_count": total, "done_count": done})

    async def update(self, epic_id: UUID, dto: UpdateEpicDTO, actor_id: UUID) -> EpicResponse:
        epic = await self.get_or_404(epic_id)
        await self._require_member(epic.workspace_id, actor_id)
        epic = await self.repo.update(epic, dto)
        total, done = await self.repo.task_counts(epic.id)
        r = EpicResponse.model_validate(epic)
        return r.model_copy(update={"task_count": total, "done_count": done})

    async def delete(self, epic_id: UUID, actor_id: UUID) -> None:
        epic = await self.get_or_404(epic_id)
        await self._require_member(epic.workspace_id, actor_id)
        await self.repo.soft_delete(epic)

    async def list_tasks(self, epic_id: UUID, user_id: UUID) -> list[Task]:
        epic = await self.get_or_404(epic_id)
        await self._require_member(epic.workspace_id, user_id)
        return await self.repo.list_tasks(epic_id)

    async def _require_member(self, workspace_id: UUID, user_id: UUID) -> None:
        member = await self.workspace_repo.get_member(workspace_id, user_id)
        if not member:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a workspace member")
