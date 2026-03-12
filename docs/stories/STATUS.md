# User Stories: Task Status & List Division (S-01 ~ S-06)

## 3.2 Task Status & List Division

| ID | As a... | I want to... | So that... |
|----|---------|--------------|------------|
| S-01 | Manager | Customize independent status fields per list (e.g. Todo → In Progress → Review → Done) | Different workflow lists have their own status semantics |
| S-02 | Manager | Set status color and order | Visually distinguish progress at a glance |
| S-03 | Manager | Mark a status as "complete" | System can auto-calculate completion rate, trigger automation |
| S-04 | Engineer | When moving a task between lists, have status mapping applied automatically | Cross-list moves don't lose progress context |
| S-05 | PM | Drag-and-drop kanban in board view using status as columns | Visual workflow management |
| S-06 | Manager | Create list templates (with default status sets) | Don't have to reconfigure for each new project |

## Implementation Notes

### S-01 / S-02 — Per-List Statuses
- `ListStatus` table scoped to `list_id`
- `order_index` uses float fractional indexing; rebalance when gap < 0.001
- `color` stored as hex string (e.g. `#3b82f6`)

### S-03 — Complete Flag
- `is_complete BOOL` on `ListStatus`
- Used to calculate task completion rate: `completed / total subtasks`
- Can be used to trigger future automation rules

### S-04 — Cross-List Status Mapping (atomic transaction)
1. Look up `StatusMapping(from_list_id, to_list_id, current_status_id)`
2. If mapping found → use `to_status_id`
3. If no mapping → use first non-complete status of target list (or prompt user)
4. Update `task.list_id` + `task.status_id`
5. Write `moved` audit entry with `metadata: {from_list_id, to_list_id, from_status, to_status}`

### S-05 — Kanban Board
- Each `KanbanColumn` = one `ListStatus`
- Drag-drop via `@dnd-kit/core`
- On drop: optimistic PATCH `{status_id, order_index}`, revert on API error

### S-06 — List Templates
- `ListTemplate` table with `default_statuses JSONB`
- `POST /projects/{id}/lists/from-template` applies template statuses on creation
