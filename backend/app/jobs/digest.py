"""N-02: Daily job — send notification digest email to users who prefer it."""
import logging

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.core.email import send_email
from app.core.email_templates import digest_email
from app.features.notifications.repository import NotificationRepository
from app.features.workspaces.repository import WorkspaceRepository

logger = logging.getLogger(__name__)


async def send_notification_digest() -> None:
    """Email each digest-preference user their unread notifications from the past 24 hours."""
    async with AsyncSessionLocal() as session:
        notif_repo = NotificationRepository(session)
        ws_repo = WorkspaceRepository(session)

        unread_by_user = await notif_repo.get_unread_grouped_by_user(since_hours=24)
        logger.info("send_notification_digest: %d users have unread notifications", len(unread_by_user))

        for user_id, notifications in unread_by_user.items():
            user = await ws_repo.get_user_by_id(user_id)
            if user and user.email and notifications:
                count = len(notifications)
                await send_email(
                    to=user.email,
                    subject=f"IssueHub — {count} update{'s' if count != 1 else ''}",
                    html=digest_email(notifications, frontend_url=settings.frontend_url),
                )
