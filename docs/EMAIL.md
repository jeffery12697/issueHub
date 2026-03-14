# Email — Design Plan

## Overview

Transactional emails are sent when an event occurs (mention, assignment, watcher update, overdue task). They are **fire-and-forget** — no scheduler required for event-triggered emails.

---

## Provider

Use **[Resend](https://resend.com)** (recommended) or SendGrid.

- Clean REST API, no SMTP server needed — just an API key
- Free tier: 3,000 emails/month
- Simple Python SDK

```bash
pip install resend
```

---

## New env vars (`.env`)

```env
RESEND_API_KEY=re_xxxxxxxxxxxx
EMAIL_FROM=noreply@yourdomain.com
EMAIL_ENABLED=true          # set false in dev to skip sending
```

Add to `app/core/config.py`:

```python
resend_api_key: str = ""
email_from: str = "noreply@issuehub.app"
email_enabled: bool = False
```

---

## New module: `app/core/email.py`

Single async helper — all email sending goes through here:

```python
import resend
from app.core.config import settings

async def send_email(to: str, subject: str, html: str) -> None:
    if not settings.email_enabled or not settings.resend_api_key:
        return  # no-op in dev
    resend.api_key = settings.resend_api_key
    resend.Emails.send({
        "from": settings.email_from,
        "to": to,
        "subject": subject,
        "html": html,
    })
```

---

## Email templates: `app/core/email_templates.py`

Plain Python f-strings — no template engine needed:

```python
def mention_email(actor: str, task_title: str, task_url: str) -> str:
    return f"""
    <p><strong>{actor}</strong> mentioned you in a comment on
    <a href="{task_url}">{task_title}</a>.</p>
    """

def assignment_email(actor: str, task_title: str, task_url: str) -> str:
    return f"""
    <p>You were assigned to <a href="{task_url}">{task_title}</a>
    by <strong>{actor}</strong>.</p>
    """

def watcher_update_email(task_title: str, field: str, task_url: str) -> str:
    return f"""
    <p>A task you are watching was updated:
    <a href="{task_url}">{task_title}</a> — {field} changed.</p>
    """

def overdue_email(task_title: str, task_url: str, due_date: str) -> str:
    return f"""
    <p>A task assigned to you is overdue:
    <a href="{task_url}">{task_title}</a> (due {due_date}).</p>
    """

def digest_email(notifications: list) -> str:
    items = "".join(f"<li>{n.body}</li>" for n in notifications)
    return f"<p>Your IssueHub updates:</p><ul>{items}</ul>"
```

---

## Where to fire emails

Use FastAPI `BackgroundTasks` — runs after the response is sent, no delay for the caller, no extra infrastructure:

| Event | Where to add | Template |
|-------|-------------|----------|
| @mention in comment | `comments/router.py` after `create_comment` | `mention_email` |
| Task assigned to user | `tasks/router.py` after `PATCH` when `assignee_ids` grows | `assignment_email` |
| Watcher task updated | existing watcher notification logic | `watcher_update_email` |
| Task overdue | APScheduler job (see `BACKGROUND_JOBS.md`) | `overdue_email` |
| Notification digest | APScheduler job (see `BACKGROUND_JOBS.md`) | `digest_email` |

### Example — `comments/router.py`

```python
from fastapi import BackgroundTasks
from app.core.email import send_email
from app.core.email_templates import mention_email

@router.post("/tasks/{task_id}/comments", ...)
async def create_comment(
    ...,
    background_tasks: BackgroundTasks,
):
    comment = await service.create_comment(task_id, body, actor_id=current_user.id)
    await session.commit()

    for user in comment.mentioned_users:
        background_tasks.add_task(
            send_email,
            to=user.email,
            subject=f"You were mentioned in {task.title}",
            html=mention_email(current_user.display_name, task.title, task_url),
        )
    return CommentResponse.model_validate(comment)
```

---

## Implementation Steps

| Step | Work | Story |
|------|------|-------|
| 1 | Add `resend` to `requirements.txt`, add env vars to `config.py` | — |
| 2 | Create `app/core/email.py` + `app/core/email_templates.py` | — |
| 3 | Email on @mention | N-03 |
| 4 | Email on assignment | M-05 |
| 5 | Email on watcher update | N-01 |
| 6 | Overdue + digest emails via scheduler | AU-02, N-02 (see `BACKGROUND_JOBS.md`) |

Steps 1–5 require no scheduler and can ship independently.

---

## Key Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Provider | Resend | Simple REST API, no SMTP server, generous free tier |
| Delivery method | FastAPI `BackgroundTasks` | Non-blocking, zero infrastructure overhead |
| Dev mode | `EMAIL_ENABLED=false` skips all sends | No accidental emails during development |
