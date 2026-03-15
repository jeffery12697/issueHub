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
