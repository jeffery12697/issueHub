from uuid import UUID

from fastapi import HTTPException, status

from app.features.audit.repository import AuditRepository
from app.features.comments.repository import CommentRepository
from app.features.comments.schemas import CreateCommentDTO
from app.features.tasks.repository import TaskRepository
from app.features.workspaces.repository import WorkspaceRepository
from app.models.comment import Comment


class CommentService:
    def __init__(
        self,
        repo: CommentRepository,
        task_repo: TaskRepository,
        workspace_repo: WorkspaceRepository,
        audit_repo: AuditRepository,
    ):
        self.repo = repo
        self.task_repo = task_repo
        self.workspace_repo = workspace_repo
        self.audit_repo = audit_repo

    async def create(
        self,
        task_id: UUID,
        body: str,
        parent_comment_id: UUID | None,
        author_id: UUID,
    ) -> Comment:
        task = await self.task_repo.get_by_id(task_id)
        if not task:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
        member = await self.workspace_repo.get_member(task.workspace_id, author_id)
        if not member:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a workspace member")

        mentions = await self._resolve_mentions(body, task.workspace_id)
        dto = CreateCommentDTO(
            task_id=task_id,
            author_id=author_id,
            body=body,
            parent_comment_id=parent_comment_id,
            mentions=mentions,
        )
        comment = await self.repo.create(dto)
        await self.audit_repo.log(task_id, actor_id=author_id, action="commented")
        return comment

    async def list_for_task(self, task_id: UUID, user_id: UUID) -> list[tuple[Comment, str]]:
        task = await self.task_repo.get_by_id(task_id)
        if not task:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
        member = await self.workspace_repo.get_member(task.workspace_id, user_id)
        if not member:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a workspace member")
        return await self.repo.list_for_task(task_id)

    async def delete(self, comment_id: UUID, user_id: UUID) -> None:
        comment = await self.repo.get_by_id(comment_id)
        if not comment:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")
        if comment.author_id != user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not the comment author")
        await self.repo.soft_delete(comment)

    async def _resolve_mentions(self, body: str, workspace_id: UUID) -> list[UUID]:
        members = await self.workspace_repo.list_member_users(workspace_id)
        if not members:
            return []
        body_lower = body.lower()
        return [
            u.id
            for u in members
            if f"@{u.display_name.lower()}" in body_lower
            or f"@{u.display_name.lower().replace(' ', '')}" in body_lower
        ]
