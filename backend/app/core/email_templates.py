_BASE = """
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{subject}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08);">

          <!-- Header -->
          <tr>
            <td style="background:#18181b;padding:24px 36px;">
              <span style="font-size:18px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">
                &#9680;&nbsp;IssueHub
              </span>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 36px 28px;">
              {body}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 36px 28px;border-top:1px solid #f4f4f5;">
              <p style="margin:0;font-size:12px;color:#a1a1aa;">
                You're receiving this email because you use IssueHub.
                Manage your notification preferences inside the app.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""

_CTA_BUTTON = """
<table cellpadding="0" cellspacing="0" style="margin-top:28px;">
  <tr>
    <td style="background:#18181b;border-radius:8px;">
      <a href="{url}" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">
        {label} &rarr;
      </a>
    </td>
  </tr>
</table>
"""

_TASK_CHIP = """
<table cellpadding="0" cellspacing="0" style="margin:16px 0;">
  <tr>
    <td style="background:#f4f4f5;border-radius:8px;padding:12px 16px;">
      <span style="font-size:13px;font-weight:600;color:#3f3f46;">{task_title}</span>
    </td>
  </tr>
</table>
"""


def _heading(text: str) -> str:
    return f'<h2 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#18181b;letter-spacing:-0.3px;">{text}</h2>'


def _subtext(text: str) -> str:
    return f'<p style="margin:0;font-size:15px;color:#52525b;line-height:1.6;">{text}</p>'


def _render(subject: str, body: str) -> str:
    return _BASE.format(subject=subject, body=body)


# ── Public templates ──────────────────────────────────────────────────────────

def mention_email(actor: str, task_title: str, task_url: str) -> str:
    body = (
        _heading("You were mentioned")
        + _subtext(f"<strong style='color:#18181b;'>{actor}</strong> mentioned you in a comment.")
        + _TASK_CHIP.format(task_title=task_title)
        + _CTA_BUTTON.format(url=task_url, label="View comment")
    )
    return _render("You were mentioned", body)


def assignment_email(actor: str, task_title: str, task_url: str) -> str:
    body = (
        _heading("You have been assigned a task")
        + _subtext(f"<strong style='color:#18181b;'>{actor}</strong> assigned you to a task.")
        + _TASK_CHIP.format(task_title=task_title)
        + _CTA_BUTTON.format(url=task_url, label="View task")
    )
    return _render("New task assignment", body)


def watcher_update_email(task_title: str, field: str, task_url: str) -> str:
    label_map = {
        "comment": "A new comment was posted",
        "task": "A task was updated",
    }
    heading = label_map.get(field, "A task you are watching was updated")
    body = (
        _heading(heading)
        + _subtext("You are watching this task and will be notified of activity.")
        + _TASK_CHIP.format(task_title=task_title)
        + _CTA_BUTTON.format(url=task_url, label="View task")
    )
    return _render(heading, body)


def overdue_email(task_title: str, task_url: str, due_date: str) -> str:
    body = (
        _heading("Task overdue")
        + _subtext(f"A task assigned to you passed its due date of <strong style='color:#18181b;'>{due_date}</strong>.")
        + _TASK_CHIP.format(task_title=task_title)
        + _CTA_BUTTON.format(url=task_url, label="View task")
    )
    return _render("Task overdue", body)


def digest_email(notifications: list) -> str:
    rows = "".join(
        f"""
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #f4f4f5;font-size:14px;color:#3f3f46;line-height:1.5;">
            {n.body}
          </td>
        </tr>
        """
        for n in notifications
    )
    count = len(notifications)
    summary = f"{count} new update{'s' if count != 1 else ''}"
    body = (
        _heading("Your daily digest")
        + _subtext(f"Here's what happened while you were away — <strong style='color:#18181b;'>{summary}</strong>.")
        + f"""
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;">
          {rows}
        </table>
        """
    )
    return _render("Your IssueHub digest", body)
