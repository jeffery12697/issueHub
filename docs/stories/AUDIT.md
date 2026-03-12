# User Stories: Audit Trail (A-01 ~ A-05)

## 1.2 Complete Audit Trail

| ID | As a... | I want to... | So that... |
|----|---------|--------------|------------|
| A-01 | PM | See history of all field changes on a task (who, when, what changed) | I can trace the decision process |
| A-02 | Engineer | Leave comments on a task and @mention teammates | Important discussions are recorded |
| A-03 | Manager | See task status change logs (including assignee changes) | I can evaluate process bottlenecks |
| A-04 | Engineer | See add/remove records for attachments and links | I don't lose context of attached info |
| A-05 | Anyone | See each audit log entry with timestamp and actor identity | Records are non-repudiable and accountable |

## Implementation Notes

### AuditLog Table
- **Append-only** — no UPDATE or DELETE ever
- Partitioned monthly by `created_at`
- Indexed on `(task_id, created_at DESC)`
- Written via FastAPI `BackgroundTask` (non-blocking, after HTTP response)

### Tracked Actions
`created`, `updated`, `commented`, `status_changed`, `assignee_changed`, `moved`, `promoted`, `subtask_added`, `dependency_added`, `dependency_removed`, `attachment_added`, `attachment_removed`, `link_added`, `link_removed`, `custom_field_updated`

### A-02 — Comments & @mention
- `Comment` table with `mentions UUID[]` (parsed from `@username` in body)
- @mention parsing: regex scan on save, resolve usernames to user IDs
- Threaded replies via `parent_comment_id` self-ref

### Activity Feed API
- `GET /tasks/{id}/activity` — merged audit + comments, ordered by `created_at DESC`
- Cursor-based pagination (never offset)
- Frontend `ActivityTimeline` is a virtualized list with real-time WebSocket subscription
