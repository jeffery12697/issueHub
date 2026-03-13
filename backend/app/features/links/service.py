from uuid import UUID
from fastapi import HTTPException, status
from app.features.links.repository import LinkRepository
from app.features.links.schemas import CreateLinkDTO
from app.features.tasks.repository import TaskRepository
from app.features.workspaces.repository import WorkspaceRepository
from app.features.audit.repository import AuditRepository
from app.models.task_link import TaskLink


class LinkService:
    def __init__(
        self,
        repo: LinkRepository,
        task_repo: TaskRepository,
        workspace_repo: WorkspaceRepository,
        audit_repo: AuditRepository,
    ):
        self.repo = repo
        self.task_repo = task_repo
        self.workspace_repo = workspace_repo
        self.audit_repo = audit_repo

    async def create(self, task_id: UUID, url: str, title: str | None, actor_id: UUID) -> TaskLink:
        task = await self.task_repo.get_by_id(task_id)
        if not task:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
        member = await self.workspace_repo.get_member(task.workspace_id, actor_id)
        if not member:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a workspace member")
        dto = CreateLinkDTO(task_id=task_id, created_by=actor_id, url=url, title=title)
        link = await self.repo.create(dto)
        await self.audit_repo.log(task_id, actor_id=actor_id, action="link_added", changes={"url": [None, url]})
        return link

    async def list_for_task(self, task_id: UUID, user_id: UUID) -> list[TaskLink]:
        task = await self.task_repo.get_by_id(task_id)
        if not task:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
        member = await self.workspace_repo.get_member(task.workspace_id, user_id)
        if not member:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a workspace member")
        return await self.repo.list_for_task(task_id)

    async def delete(self, task_id: UUID, link_id: UUID, actor_id: UUID) -> None:
        link = await self.repo.get_by_id(link_id)
        if not link or link.task_id != task_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Link not found")
        task = await self.task_repo.get_by_id(task_id)
        member = await self.workspace_repo.get_member(task.workspace_id, actor_id)
        if not member:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a workspace member")
        url = link.url
        await self.repo.soft_delete(link)
        await self.audit_repo.log(task_id, actor_id=actor_id, action="link_removed", changes={"url": [url, None]})
