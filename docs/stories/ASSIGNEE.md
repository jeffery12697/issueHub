# User Stories: Task Assignee (M-05 ~ M-08)

## 3.2 Task Assignee

| ID | As a... | I want to... | So that... |
|----|---------|--------------|------------|
| M-05 | PM | Assign a task to one or more members | Responsibility is clearly defined |
| M-06 | Engineer | See all tasks assigned to me on a My Tasks page (cross-list, cross-team) | I don't have to open each list individually |
| M-07 | PM | See a member's current task workload (workload view) | I can make reasonable resource allocation decisions |
| M-08 | Engineer | Set a reviewer on a task (distinct from assignee) | Distinguish between executor and reviewer roles |

## Implementation Notes

### M-05 — Multi-Assignee
- `Task.assignee_ids UUID[]` — array of user IDs
- API accepts array in `PATCH /tasks/{id}` body: `{"assignee_ids": ["uuid1", "uuid2"]}`
- Audit entry written on assignee change: `action: assignee_changed`, `old_value`, `new_value`

### M-06 — My Tasks Page
- `GET /api/v1/me/tasks` — returns all tasks where `current_user.id = ANY(assignee_ids)`
- Supports filtering: `?status=open`, `?priority=high`, `?due_before=2026-01-01`
- Cross-list, cross-project, cross-team — scoped to workspace
- Frontend: `MyTasksPage` view, grouped by list or due date

### M-07 — Workload View
- `GET /api/v1/members/{user_id}/workload` — returns open task count + list of tasks
- Frontend: workload view shows per-member task counts, optionally filterable by date range
- Phase 4+ feature: capacity planning with story points or time estimates

### M-08 — Reviewer
- `Task.reviewer_id UUID FK → User` (nullable, single reviewer)
- Displayed separately from assignees in task detail
- Audit entry on reviewer change
- Future: reviewer receives notification when task moves to Review status
