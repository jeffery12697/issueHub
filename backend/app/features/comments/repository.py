from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.comments.schemas import CreateCommentDTO
from app.models.comment import Comment


class CommentRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, dto: CreateCommentDTO) -> Comment:
        comment = Comment(
            task_id=dto.task_id,
            author_id=dto.author_id,
            body=dto.body,
            parent_comment_id=dto.parent_comment_id,
            mentions=dto.mentions,
        )
        self.session.add(comment)
        await self.session.flush()
        return comment

    async def list_for_task(self, task_id: UUID) -> list[Comment]:
        result = await self.session.execute(
            select(Comment)
            .where(Comment.task_id == task_id)
            .where(Comment.deleted_at.is_(None))
            .order_by(Comment.created_at.asc())
        )
        return list(result.scalars().all())

    async def get_by_id(self, comment_id: UUID) -> Comment | None:
        result = await self.session.execute(
            select(Comment)
            .where(Comment.id == comment_id)
            .where(Comment.deleted_at.is_(None))
        )
        return result.scalar_one_or_none()

    async def soft_delete(self, comment: Comment) -> None:
        comment.soft_delete()
        await self.session.flush()
