"""AU-02: Daily job — email assignees of newly overdue tasks."""
import logging

from app.core.database import AsyncSessionLocal
from app.core.email import send_email
from app.core.email_templates import overdue_email
from app.core.config import settings
from app.features.tasks.repository import TaskRepository
from app.features.workspaces.repository import WorkspaceRepository

logger = logging.getLogger(__name__)


async def check_overdue_tasks() -> None:
    """Scan for tasks that just became overdue and email each assignee once."""
    async with AsyncSessionLocal() as session:
        task_repo = TaskRepository(session)
        ws_repo = WorkspaceRepository(session)

        overdue = await task_repo.get_newly_overdue()
        logger.info("check_overdue_tasks: found %d newly overdue tasks", len(overdue))

        for task in overdue:
            task_url = f"{settings.frontend_url}/tasks/{task.id}"
            due_str = task.due_date.strftime("%Y-%m-%d") if task.due_date else ""

            for user_id in task.assignee_ids:
                user = await ws_repo.get_user_by_id(user_id)
                if user and user.email:
                    await send_email(
                        to=user.email,
                        subject=f"Overdue: {task.title}",
                        html=overdue_email(task.title, task_url, due_str),
                    )

            await task_repo.mark_overdue_notified(task.id)

        await session.commit()
