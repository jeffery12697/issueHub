from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.attachment import Attachment


class AttachmentRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(
        self,
        task_id: UUID,
        comment_id: UUID | None,
        uploaded_by: UUID,
        filename: str,
        s3_key: str,
        size: int,
        mime_type: str,
    ) -> Attachment:
        att = Attachment(
            task_id=task_id,
            comment_id=comment_id,
            uploaded_by=uploaded_by,
            filename=filename,
            s3_key=s3_key,
            size=size,
            mime_type=mime_type,
        )
        self.session.add(att)
        await self.session.flush()
        return att

    async def list_for_task(self, task_id: UUID, comment_id: UUID | None = None) -> list[Attachment]:
        q = select(Attachment).where(Attachment.task_id == task_id)
        if comment_id is None:
            q = q.where(Attachment.comment_id.is_(None))
        else:
            q = q.where(Attachment.comment_id == comment_id)
        q = q.order_by(Attachment.created_at.asc())
        result = await self.session.execute(q)
        return list(result.scalars().all())

    async def get_by_id(self, attachment_id: UUID) -> Attachment | None:
        result = await self.session.execute(
            select(Attachment).where(Attachment.id == attachment_id)
        )
        return result.scalar_one_or_none()

    async def delete(self, attachment: Attachment) -> None:
        await self.session.delete(attachment)
        await self.session.flush()
