# Automation User Stories (AU)

| #     | As a...  | I want to...                                                                                      | So that...                                        |
|-------|----------|---------------------------------------------------------------------------------------------------|---------------------------------------------------|
| AU-01 | PM       | Define trigger-action rules (e.g. status changes to Review → auto-assign reviewer)               | Manual handoff steps are eliminated               |
| AU-02 | Admin    | Configure automatic notifications for overdue tasks                                               | No one has to manually chase overdue work         |
| AU-03 | PM       | Automatically update a parent task's status when all its subtasks are completed                   | I don't have to update the parent task manually   |
| AU-04 | Engineer | Close a task automatically via a Git commit message keyword (e.g. `closes #<task-id>`)           | Development and issue tracking are seamlessly linked |

## Notes

- **AU-01** — Needs an `Automation` model: `trigger_type` (e.g. `status_changed`), `trigger_value`, `action_type` (e.g. `assign_reviewer`), `action_value`. Evaluated in the task update service after each mutation.
- **AU-02** — Needs a background scheduler (e.g. APScheduler or a cron job). Scans tasks where `due_date < now` and status is not complete, then fires notifications. Requires notification delivery (in-app already exists; email needs SMTP).
- **AU-03** — Hook into `create_subtask` / `update` service: after any subtask status change, check if all siblings are in a `is_complete` status; if so, update parent task status to the list's first `is_complete` status.
- **AU-04** — Webhook endpoint `POST /webhooks/git` that parses commit messages for `closes #<task_id>` / `fixes #<task_id>` and calls the task close logic. Requires a shared secret for verification.
