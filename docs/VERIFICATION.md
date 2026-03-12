# Launch Verification Strategy

Procedures for verifying data accuracy and system correctness before going live.
Automated tests already exist; this focuses on visual and data-level verification.

---

## Timeline

| When | What |
|------|------|
| After Phase 1 | Auth flow, task CRUD, board/list rendering |
| After Phase 2 | Subtask tree integrity, audit trail completeness |
| After Phase 3 | Custom field validation, status mapping correctness |
| After Phase 4 | Real-time parity (WebSocket), attachment upload/download |
| Before go-live | Full `verify:all` on staging data, sign-off, deploy |

---

## Local Environment Setup

```
┌──────────────────────────────────────────────┐
│  IssueHub (devcontainer)                      │
│  FastAPI + React SPA                          │
│                                               │
│  API:  localhost:8000                         │
│  SPA:  localhost:5173 (Vite)                  │
│                                               │
│  PostgreSQL: issuehub (app DB)                │
│  Redis:      localhost:6379                   │
└──────────────────────────────────────────────┘
```

**Steps:**
1. Start services: `docker compose up -d`
2. Run migrations: `docker compose exec backend alembic upgrade head`
3. Seed test data: `docker compose exec backend python -m app.scripts.seed`
4. Verify: `docker compose exec backend python -m app.scripts.verify_all`

---

## Visual Verification (Page-by-Page)

Open the app and walk through every page. Check rendering, interactions, and data correctness.

| # | Page | URL | Check |
|---|------|-----|-------|
| 1 | Login | `/login` | Email/password auth, redirect to workspace |
| 2 | Workspace | `/workspace` | Project list, member count |
| 3 | Project | `/projects/:id` | List of lists, correct names |
| 4 | List View | `/lists/:id` | All tasks render, priority/assignee/due date visible |
| 5 | Board View | `/lists/:id/board` | Columns match statuses, tasks in correct columns |
| 6 | Task Detail | `/tasks/:id` | All fields, subtask tree, activity timeline |
| 7 | Subtask Tree | (in Task Detail) | Multi-level nesting, collapse/expand |
| 8 | Audit Trail | (in Task Detail) | All field changes logged with actor + timestamp |
| 9 | Comments | (in Task Detail) | Comments render, @mentions highlighted |
| 10 | Attachments | (in Task Detail) | Upload, download, delete |
| 11 | Dependencies | (in Task Detail) | Blockers + blocked-by shown with links |
| 12 | My Tasks | `/me/tasks` | All cross-list assigned tasks, filters work |
| 13 | Workload View | `/workspace/workload` | Per-member open task count |
| 14 | List Settings | `/lists/:id/settings` | Status manager, custom fields, templates |
| 15 | Status Manager | (in List Settings) | Drag reorder, color picker, complete toggle |
| 16 | Custom Fields | (in List Settings) | Add/edit/delete, required flag, role visibility |
| 17 | Status Mapping | (in List Settings) | Cross-list move maps correctly |
| 18 | Templates | `/workspace/templates` | Create list from template applies statuses |
| 19 | Workspace Settings | `/workspace/settings` | Members, roles, team management |
| 20 | Team Visibility | (in Workspace Settings) | Restricted list hidden from non-team members |

---

## Task Tree Integrity Verification (Most Critical)

The `ltree` path is the foundation of subtask queries. A single bad path breaks the entire tree.

### Step 1: Pick sample task trees to verify

Select 3–5 tasks with deep subtask nesting from staging data.

### Step 2: Verify paths in DB

```sql
-- Every task's path must start with the root ancestor's id
SELECT
  t.id,
  t.path,
  t.parent_task_id,
  t.depth,
  subpath(t.path, 0, 1)::text AS path_root
FROM tasks t
WHERE t.deleted_at IS NULL
  AND t.parent_task_id IS NOT NULL
ORDER BY t.path;
-- Manually confirm: path_root matches root task id for every row
```

### Step 3: Verify subtree query returns all descendants

```python
# Run in Python shell: docker compose exec backend python
from app.features.tasks.repository import TaskRepository
# pick a known root task id from staging
tree = await repo.get_tree(root_id=UUID("..."))
print(f"Expected N descendants, got {len(tree)}")
```

### Step 4: Verify promote operation

1. Pick a subtask at depth 2 or deeper
2. Call `POST /api/v1/tasks/{id}/promote`
3. Confirm in DB:
   - `parent_task_id = NULL`
   - `depth = 0`
   - `path = task.id` (single segment)
   - All former descendants have paths updated with new prefix

### Step 5: Acceptance Criteria

| Check | Pass Criteria |
|-------|---------------|
| Path root matches root ancestor | All rows match |
| Subtree query count | Matches expected descendant count |
| `depth` matches `nlevel(path) - 1` | All rows match |
| After promote: no stale paths | 0 rows with old prefix |

---

## Audit Trail Completeness Verification

Every mutation must produce an audit entry. Spot-check 5 operations.

**Operations to test manually:**

| Action | Expected `action` in AuditLog |
|--------|-------------------------------|
| Create task | `created` |
| Change task status | `status_changed` with `old_value`, `new_value` |
| Change assignee | `assignee_changed` |
| Add comment | `commented` |
| Upload attachment | `attachment_added` |
| Move task to different list | `moved` with `metadata.from_list_id`, `metadata.to_list_id` |
| Promote subtask | `promoted` |
| Add dependency | `dependency_added` |

**Verify in DB after each action:**
```sql
SELECT action, actor_id, old_value, new_value, metadata, created_at
FROM audit_logs
WHERE task_id = '<task_id>'
ORDER BY created_at DESC
LIMIT 10;
```

---

## Custom Field Validation Verification

| Scenario | Expected Result |
|----------|-----------------|
| Save task with required field empty | HTTP 422, field name in error response |
| Save task with required field filled | HTTP 200, task saved |
| Member reads field with `visibility_roles = ['admin']` | Field not in API response |
| Member writes to field with `editable_roles = ['admin']` | HTTP 403 |
| Filter tasks by number field `?cf[id][gte]=5` | Only tasks with value ≥ 5 returned |
| Filter tasks by date field `?cf[id][lte]=2026-12-31` | Only tasks with date ≤ date returned |

---

## Automated Verification Script

```bash
docker compose exec backend python -m app.scripts.verify_all
```

Expected output:
```
========================================
IssueHub Verification Report
========================================

📊 Data Integrity
  tasks (no orphaned list_id):      ✅
  ltree paths (no broken paths):    ✅
  audit_logs (no missing actor):    ✅
  custom_field_values (no orphans): ✅

🌳 Task Tree Integrity
  Sample tree A (12 nodes): ✅
  Sample tree B (7 nodes):  ✅
  Sample tree C (3 nodes):  ✅

📋 Audit Completeness (5 ops sampled)
  created:            ✅
  status_changed:     ✅
  assignee_changed:   ✅
  attachment_added:   ✅
  moved:              ✅

🔌 Real-time
  WebSocket connect:  ✅
  Event broadcast:    ✅
  Redis reachable:    ✅

========================================
Result: ALL CHECKS PASSED ✅
========================================
```

---

## Post-Launch Checklist

- [ ] All pages accessible and rendered correctly
- [ ] Login and JWT refresh work
- [ ] Task CRUD (create, edit, delete, restore) works
- [ ] Subtask tree renders all levels correctly
- [ ] Drag-and-drop on board updates status and order
- [ ] Task move between lists applies status mapping
- [ ] Subtask promote clears parent and updates all descendant paths
- [ ] Custom fields appear only on tasks in the correct list
- [ ] Required field validation blocks save with missing values
- [ ] Role-restricted fields not visible/editable by unauthorized roles
- [ ] Audit trail shows all changes with correct actor and timestamp
- [ ] Comments with @mentions render correctly
- [ ] Attachments upload and download successfully
- [ ] Real-time: card move in tab A reflects in tab B without refresh
- [ ] My Tasks shows cross-list assigned tasks
- [ ] Team-restricted lists hidden from non-team members
- [ ] Timezone: due date filters use Asia/Taipei boundaries correctly
