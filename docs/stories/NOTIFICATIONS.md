# Notifications User Stories (N)

| #    | As a... | I want to...                                       | So that...                          |
|------|---------|----------------------------------------------------|-------------------------------------|
| N-01 | 工程師  | 訂閱一個 task 的變更通知                           | 即使沒被 assign，也能追蹤動態      |
| N-02 | 工程師  | 設定通知的頻率（即時 / 日摘）                      | 不被通知轟炸                        |
| N-03 | 工程師  | 收到 @mention 時立即通知                           | 重要事項不遺漏                      |

## Notes

- **N-01** — Add `TaskWatcher` join table (task_id, user_id). "Watch" button in TaskDetailPage. Audit/comment events fan out to all watchers, not just assignees. In-app notification bell already exists — extend to include watcher events.
- **N-02** — Add `notification_preference: 'immediate' | 'digest'` to the User model. For digest users, queue notifications and send a daily summary (requires scheduler + email). Immediate users get real-time in-app (already works via WebSocket).
- **N-03** — @mention in comments is already implemented (A-02). Verify that the existing notification row is created and surfaced in the NotificationBell for mentioned users. If missing, add a `notification` insert in the comment creation service when `@name` is detected in the body.
