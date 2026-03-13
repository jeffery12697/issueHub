from uuid import UUID

from fastapi import HTTPException, status

from app.features.lists.repository import ListRepository
from app.features.lists.schemas import (
    CreateListDTO,
    UpdateListDTO,
    CreateStatusDTO,
    UpdateStatusDTO,
    ReorderStatusDTO,
)
from app.features.workspaces.repository import WorkspaceRepository
from app.features.projects.repository import ProjectRepository
from app.models.list_ import List
from app.models.list_status import ListStatus
from app.models.workspace import WorkspaceRole

REBALANCE_THRESHOLD = 0.001


class ListService:
    def __init__(
        self,
        repo: ListRepository,
        workspace_repo: WorkspaceRepository,
        project_repo: ProjectRepository,
    ):
        self.repo = repo
        self.workspace_repo = workspace_repo
        self.project_repo = project_repo

    async def create(self, dto: CreateListDTO) -> List:
        project = await self.project_repo.get_by_id(dto.project_id)
        if not project:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
        await self._require_workspace_member(project.workspace_id, dto.created_by)
        return await self.repo.create(dto)

    async def get_or_404(self, list_id: UUID, load_statuses: bool = False) -> List:
        list_ = await self.repo.get_by_id(list_id, load_statuses=load_statuses)
        if not list_:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="List not found")
        return list_

    async def list_for_project(self, project_id: UUID, user_id: UUID) -> list[List]:
        project = await self.project_repo.get_by_id(project_id)
        if not project:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
        await self._require_workspace_member(project.workspace_id, user_id)
        return await self.repo.list_for_project(project_id)

    async def update(self, list_id: UUID, dto: UpdateListDTO, actor_id: UUID) -> List:
        list_ = await self.get_or_404(list_id)
        project = await self.project_repo.get_by_id(list_.project_id)
        await self._require_workspace_member(project.workspace_id, actor_id)
        return await self.repo.update(list_, dto)

    async def delete(self, list_id: UUID, actor_id: UUID) -> None:
        list_ = await self.get_or_404(list_id)
        project = await self.project_repo.get_by_id(list_.project_id)
        await self._require_role(project.workspace_id, actor_id, {WorkspaceRole.owner, WorkspaceRole.admin})
        await self.repo.soft_delete(list_)

    # --- Status management ---

    async def list_statuses(self, list_id: UUID) -> list[ListStatus]:
        await self.get_or_404(list_id)
        return await self.repo.list_statuses(list_id)

    async def create_status(self, list_id: UUID, dto: CreateStatusDTO, actor_id: UUID) -> ListStatus:
        list_ = await self.get_or_404(list_id)
        project = await self.project_repo.get_by_id(list_.project_id)
        await self._require_role(project.workspace_id, actor_id, {WorkspaceRole.owner, WorkspaceRole.admin})

        existing = await self.repo.list_statuses(list_id)
        order_index = (existing[-1].order_index + 100.0) if existing else 100.0

        return await self.repo.create_status(
            CreateStatusDTO(
                list_id=list_id,
                name=dto.name,
                color=dto.color,
                category=dto.category,
                order_index=order_index,
            )
        )

    async def update_status(self, list_id: UUID, status_id: UUID, dto: UpdateStatusDTO, actor_id: UUID) -> ListStatus:
        list_ = await self.get_or_404(list_id)
        project = await self.project_repo.get_by_id(list_.project_id)
        await self._require_role(project.workspace_id, actor_id, {WorkspaceRole.owner, WorkspaceRole.admin})

        existing_status = await self.repo.get_status_by_id(status_id)
        if not existing_status or existing_status.list_id != list_id:
            raise HTTPException(status_code=404, detail="Status not found")

        if dto.is_complete is True:
            all_statuses = await self.repo.list_statuses(list_id)
            conflict = next(
                (s for s in all_statuses if s.is_complete and s.id != status_id),
                None,
            )
            if conflict:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"Status '{conflict.name}' is already marked as Done. Only one Done status is allowed per list.",
                )

        return await self.repo.update_status(existing_status, dto)

    async def delete_status(self, list_id: UUID, status_id: UUID, actor_id: UUID) -> None:
        list_ = await self.get_or_404(list_id)
        project = await self.project_repo.get_by_id(list_.project_id)
        await self._require_role(project.workspace_id, actor_id, {WorkspaceRole.owner, WorkspaceRole.admin})

        status = await self.repo.get_status_by_id(status_id)
        if not status or status.list_id != list_id:
            raise HTTPException(status_code=404, detail="Status not found")

        await self.repo.soft_delete_status(status)

    async def reorder_status(self, list_id: UUID, dto: ReorderStatusDTO, actor_id: UUID) -> list[ListStatus]:
        list_ = await self.get_or_404(list_id)
        project = await self.project_repo.get_by_id(list_.project_id)
        await self._require_role(project.workspace_id, actor_id, {WorkspaceRole.owner, WorkspaceRole.admin})

        status = await self.repo.get_status_by_id(dto.status_id)
        if not status or status.list_id != list_id:
            raise HTTPException(status_code=404, detail="Status not found")

        statuses = await self.repo.list_statuses(list_id)
        index_map = {s.id: s.order_index for s in statuses}

        before_idx = index_map.get(dto.before_id, None) if dto.before_id else None
        after_idx = index_map.get(dto.after_id, None) if dto.after_id else None

        if before_idx is not None and after_idx is not None:
            new_index = (before_idx + after_idx) / 2
        elif after_idx is not None:
            new_index = after_idx / 2
        elif before_idx is not None:
            new_index = before_idx + 100.0
        else:
            new_index = 100.0

        await self.repo.update_status_order(status, new_index)

        # Rebalance if gap is too small
        updated = await self.repo.list_statuses(list_id)
        indices = sorted(s.order_index for s in updated)
        gaps = [b - a for a, b in zip(indices, indices[1:])]
        if gaps and min(gaps) < REBALANCE_THRESHOLD:
            await self.repo.rebalance_statuses(list_id)

        return await self.repo.list_statuses(list_id)

    async def _require_workspace_member(self, workspace_id: UUID, user_id: UUID) -> None:
        member = await self.workspace_repo.get_member(workspace_id, user_id)
        if not member:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a workspace member")

    async def _require_role(self, workspace_id: UUID, user_id: UUID, allowed: set[WorkspaceRole]) -> None:
        member = await self.workspace_repo.get_member(workspace_id, user_id)
        if not member or member.role not in allowed:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
