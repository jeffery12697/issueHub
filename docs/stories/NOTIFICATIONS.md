# Notifications User Stories (N)

| #    | As a...  | I want to...                                                    | So that...                                             |
|------|----------|-----------------------------------------------------------------|--------------------------------------------------------|
| N-01 | Engineer | Subscribe to change notifications on a task                     | I can follow a task even if I'm not assigned to it     |
| N-02 | Engineer | Control how often I receive notifications (immediate or digest) | I'm not overwhelmed by notification noise              |
| N-03 | Engineer | Get an immediate notification when I am @mentioned              | I never miss something that needs my attention         |

## Notes

- **N-01** — Add `TaskWatcher` join table (task_id, user_id). "Watch" button in TaskDetailPage. Audit/comment events fan out to all watchers, not just assignees. In-app notification bell already exists — extend to include watcher events.
- **N-02** — Add `notification_preference: 'immediate' | 'digest'` to the User model. For digest users, queue notifications and send a daily summary (requires scheduler + email). Immediate users get real-time in-app (already works via WebSocket).
- **N-03** — @mention in comments is already implemented (A-02). Verify that the existing notification row is created and surfaced in the NotificationBell for mentioned users. If missing, add a `notification` insert in the comment creation service when `@name` is detected in the body.
