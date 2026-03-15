# Email — Design Plan

## Overview

Transactional emails are sent when an event occurs (mention, assignment, watcher update, overdue task). They are **fire-and-forget** — no scheduler required for event-triggered emails.

---

## Provider

**SMTP** via Python's built-in `smtplib` — no extra package needed.

- Dev/test: [Mailtrap](https://mailtrap.io) sandbox (`sandbox.smtp.mailtrap.io:2525`)
- Prod: swap in any SMTP provider (SendGrid, AWS SES, Postmark, etc.) by updating env vars

---

## Env vars (`.env`)

```env
MAIL_SERVER=sandbox.smtp.mailtrap.io
MAIL_PORT=2525
MAIL_SENDER_NAME=IssueHub
MAIL_SENDER_EMAIL=noreply@issuehub.app
MAIL_USERNAME=your-mailtrap-username
MAIL_PASSWORD=your-mailtrap-password
MAIL_ENABLED=false          # set true to actually send emails
```

In `app/core/config.py`:

```python
mail_server: str = "sandbox.smtp.mailtrap.io"
mail_port: int = 2525
mail_sender_name: str = "IssueHub"
mail_sender_email: str = "noreply@issuehub.app"
mail_username: str = ""
mail_password: str = ""
mail_enabled: bool = False
```

---

## `app/core/email.py`

Async wrapper around `smtplib` — runs blocking SMTP in a thread pool via `asyncio.to_thread`:

```python
async def send_email(to: str, subject: str, html: str) -> None:
    """No-op when MAIL_ENABLED=false or credentials are missing."""
    if not settings.mail_enabled or not settings.mail_username or not settings.mail_password:
        return
    await asyncio.to_thread(_send_smtp, to, subject, html)
```

---

## `app/core/email_templates.py`

Plain Python f-strings — no template engine:

| Function | Used for |
|----------|----------|
| `mention_email(actor, task_title, task_url)` | @mention in comment |
| `assignment_email(actor, task_title, task_url)` | Task assigned |
| `watcher_update_email(task_title, field, task_url)` | Watcher task updated |
| `overdue_email(task_title, task_url, due_date)` | Overdue task (scheduler) |
| `digest_email(notifications)` | Daily digest (scheduler) |

---

## Where to fire emails

Use FastAPI `BackgroundTasks` — runs after the response is sent:

| Event | Where | Template |
|-------|-------|----------|
| @mention in comment | `comments/router.py` after `create_comment` | `mention_email` |
| Task assigned | `tasks/router.py` after PATCH when `assignee_ids` grows | `assignment_email` |
| Watcher task updated | existing watcher notification logic | `watcher_update_email` |
| Task overdue | APScheduler job (see `BACKGROUND_JOBS.md`) | `overdue_email` |
| Notification digest | APScheduler job (see `BACKGROUND_JOBS.md`) | `digest_email` |

### Example — `comments/router.py`

```python
from fastapi import BackgroundTasks
from app.core.email import send_email
from app.core.email_templates import mention_email

@router.post("/tasks/{task_id}/comments", ...)
async def create_comment(..., background_tasks: BackgroundTasks):
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

## Key Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Provider | SMTP (`smtplib`) | Built-in, no extra package, works with any SMTP server |
| Dev testing | Mailtrap sandbox | Catches emails without delivering to real inboxes |
| Async | `asyncio.to_thread` | Non-blocking; smtplib is synchronous |
| Dev mode | `MAIL_ENABLED=false` skips all sends | No accidental emails during development |
