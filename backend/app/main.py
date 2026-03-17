import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.core.config import settings
from app.core.email import send_email
from app.features.auth.router import router as auth_router
from app.features.auth.dev import router as dev_router
from app.features.workspaces.router import router as workspaces_router
from app.features.projects.router import router as projects_router
from app.features.lists.router import router as lists_router
from app.features.tasks.router import router as tasks_router
from app.features.audit.router import router as audit_router
from app.features.dependencies.router import router as dependencies_router
from app.features.comments.router import router as comments_router
from app.features.custom_fields.router import router as custom_fields_router
from app.features.list_templates.router import router as list_templates_router
from app.features.notifications.router import router as notifications_router
from app.features.websocket.router import router as websocket_router
from app.features.websocket.manager import redis_listener
from app.features.links.router import router as links_router
from app.features.teams.router import router as teams_router
from app.features.watchers.router import router as watchers_router
from app.features.time_entries.router import router as time_entries_router
from app.features.automations.router import router as automations_router
from app.features.attachments.router import router as attachments_router
from app.features.webhooks.router import router as webhooks_router
from app.features.saved_views.router import router as saved_views_router
from app.features.status_mappings.router import router as status_mappings_router
from app.core.scheduler import scheduler
from app.core import storage
from app.jobs.overdue import check_overdue_tasks
from app.jobs.digest import send_notification_digest


@asynccontextmanager
async def lifespan(app: FastAPI):
    storage.ensure_bucket()
    scheduler.add_job(check_overdue_tasks, "cron", hour=8, minute=0, id="check_overdue_tasks")
    scheduler.add_job(send_notification_digest, "cron", hour=8, minute=0, id="send_notification_digest")
    scheduler.start()

    task = asyncio.create_task(redis_listener())
    yield

    scheduler.shutdown(wait=False)
    task.cancel()
    try:
        await task
    except (asyncio.CancelledError, Exception):
        pass


app = FastAPI(title="IssueHub API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Total-Count"],
)

app.include_router(auth_router, prefix="/api/v1")
app.include_router(dev_router, prefix="/api/v1")
app.include_router(workspaces_router, prefix="/api/v1")
app.include_router(projects_router, prefix="/api/v1")
app.include_router(lists_router, prefix="/api/v1")
app.include_router(tasks_router, prefix="/api/v1")
app.include_router(audit_router, prefix="/api/v1")
app.include_router(dependencies_router, prefix="/api/v1")
app.include_router(comments_router, prefix="/api/v1")
app.include_router(custom_fields_router, prefix="/api/v1")
app.include_router(list_templates_router, prefix="/api/v1")
app.include_router(notifications_router, prefix="/api/v1")
app.include_router(links_router, prefix="/api/v1")
app.include_router(teams_router, prefix="/api/v1")
app.include_router(watchers_router, prefix="/api/v1")
app.include_router(time_entries_router, prefix="/api/v1")
app.include_router(automations_router, prefix="/api/v1")
app.include_router(attachments_router, prefix="/api/v1")
app.include_router(webhooks_router)
app.include_router(saved_views_router, prefix="/api/v1")
app.include_router(status_mappings_router, prefix="/api/v1")
app.include_router(websocket_router)


@app.get("/health")
async def health():
    return {"status": "ok"}


class MailTestRequest(BaseModel):
    to: str
    subject: str = "IssueHub — test email"
    body: str = "If you can read this, email delivery is working."


@app.post("/api/v1/dev/mail/test")
async def test_mail(payload: MailTestRequest, background_tasks: BackgroundTasks):
    html = f"<p>{payload.body}</p>"
    background_tasks.add_task(send_email, to=payload.to, subject=payload.subject, html=html)
    return {
        "queued": True,
        "to": payload.to,
        "mail_enabled": settings.mail_enabled,
        "mail_server": settings.mail_server,
        "mail_port": settings.mail_port,
    }
