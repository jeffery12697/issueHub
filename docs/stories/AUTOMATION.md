# Automation User Stories (AU)

| #     | As a... | I want to...                                                                          | So that...                          |
|-------|---------|---------------------------------------------------------------------------------------|-------------------------------------|
| AU-01 | PM      | 設定 trigger-action 規則（如：status 變為 Review → 自動 assign 給 reviewer）         | 減少手動流程切換                    |
| AU-02 | 管理者  | 設定 overdue 任務自動發送通知                                                         | 不靠人工提醒                        |
| AU-03 | PM      | 當所有 sub-tasks 完成時，自動更新 parent task status                                  | 減少重複更新                        |
| AU-04 | 工程師  | 透過 Git commit message 的 keyword（如 `closes #123`）自動關閉 task                  | 開發與 issue 追蹤無縫整合          |

## Notes

- **AU-01** — Needs an `Automation` model: `trigger_type` (e.g. `status_changed`), `trigger_value`, `action_type` (e.g. `assign_reviewer`), `action_value`. Evaluated in the task update service after each mutation.
- **AU-02** — Needs a background scheduler (e.g. APScheduler or a cron job). Scans tasks where `due_date < now` and status is not complete, then fires notifications. Requires notification delivery (in-app already exists; email needs SMTP).
- **AU-03** — Hook into `create_subtask` / `update` service: after any subtask status change, check if all siblings are in a `is_complete` status; if so, update parent task status to the list's first `is_complete` status.
- **AU-04** — Webhook endpoint `POST /webhooks/git` that parses commit messages for `closes #<task_id>` / `fixes #<task_id>` and calls the task close logic. Requires a shared secret for verification.
