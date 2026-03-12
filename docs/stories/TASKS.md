# User Stories: Task Management (T-01 ~ T-05)

## 1.1 Basic & Nested Task Structure

| ID | As a... | I want to... | So that... |
|----|---------|--------------|------------|
| T-01 | Engineer | Create a task with title, description, priority | I can track a unit of work |
| T-02 | Engineer | Create sub-tasks under a task | I can break large work into executable units |
| T-03 | Engineer | See the full sub-task tree (multi-level nested) | I can grasp overall progress |
| T-04 | PM | Set a task as a blocker for another task | I can express dependencies between tasks |
| T-05 | Engineer | Promote a sub-task to an independent task | When a sub-item needs independent tracking |

## Implementation Notes

### T-02 / T-03 — Subtask Tree
- Task model uses `parent_task_id` (self-referential FK) + `ltree path` column
- `GET /tasks/{id}/tree` returns a flat list of all descendants in one query (`WHERE path <@ 'root_id'`)
- Frontend builds the tree client-side using `Map<id, Task[]>`
- SubtaskTree is a recursive React component with collapse/expand

### T-04 — Blocker Dependencies
- `TaskDependency` table with `dependency_type`: blocks / relates_to / duplicates
- API: `POST /tasks/{id}/dependencies`, `DELETE /tasks/{id}/dependencies/{dep_id}`
- Frontend: DependencyGraph component shows badge list of blockers/blocked-by

### T-05 — Promote Subtask (atomic, single transaction)
1. Set `parent_task_id = NULL`
2. Set `depth = 0`
3. Update `path` to just the task's own ID
4. Update all descendant paths (ltree prefix replacement)
5. Set `list_id` to target list
6. Apply status mapping (same logic as cross-list move)
7. Write `promoted` audit entry
