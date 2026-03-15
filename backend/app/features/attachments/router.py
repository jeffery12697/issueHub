"""Attachments — upload/list/delete for tasks and comments."""
import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.security import get_current_user
from app.core import storage
from app.features.attachments.repository import AttachmentRepository
from app.features.attachments.schemas import AttachmentResponse
from app.features.audit.repository import AuditRepository
from app.models.user import User

router = APIRouter(tags=["attachments"])

_MAX_SIZE = 20 * 1024 * 1024  # 20 MB


def _to_response(att) -> AttachmentResponse:
    return AttachmentResponse(
        id=att.id,
        task_id=att.task_id,
        comment_id=att.comment_id,
        uploaded_by=att.uploaded_by,
        filename=att.filename,
        size=att.size,
        mime_type=att.mime_type,
        created_at=att.created_at,
        url=storage.presigned_url(att.s3_key),
    )


@router.post(
    "/tasks/{task_id}/attachments",
    response_model=AttachmentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_attachment(
    task_id: uuid.UUID,
    file: UploadFile = File(...),
    comment_id: uuid.UUID | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    data = await file.read()
    if len(data) > _MAX_SIZE:
        raise HTTPException(status_code=413, detail="File too large (max 20 MB)")

    s3_key = f"attachments/{task_id}/{uuid.uuid4()}_{file.filename}"
    storage.upload_file(s3_key, data, file.content_type or "application/octet-stream")

    repo = AttachmentRepository(session)
    att = await repo.create(
        task_id=task_id,
        comment_id=comment_id,
        uploaded_by=current_user.id,
        filename=file.filename or "file",
        s3_key=s3_key,
        size=len(data),
        mime_type=file.content_type or "application/octet-stream",
    )

    audit = AuditRepository(session)
    await audit.log(
        task_id=task_id,
        actor_id=current_user.id,
        action="attachment_added",
        changes={"filename": file.filename},
    )

    await session.commit()
    return _to_response(att)


@router.get("/tasks/{task_id}/attachments", response_model=list[AttachmentResponse])
async def list_attachments(
    task_id: uuid.UUID,
    comment_id: uuid.UUID | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    repo = AttachmentRepository(session)
    attachments = await repo.list_for_task(task_id, comment_id=comment_id)
    return [_to_response(a) for a in attachments]


@router.delete("/attachments/{attachment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_attachment(
    attachment_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    repo = AttachmentRepository(session)
    att = await repo.get_by_id(attachment_id)
    if not att:
        raise HTTPException(status_code=404, detail="Attachment not found")
    if att.uploaded_by != current_user.id:
        raise HTTPException(status_code=403, detail="Not your attachment")

    storage.delete_file(att.s3_key)

    audit = AuditRepository(session)
    await audit.log(
        task_id=att.task_id,
        actor_id=current_user.id,
        action="attachment_removed",
        changes={"filename": att.filename},
    )

    await repo.delete(att)
    await session.commit()
