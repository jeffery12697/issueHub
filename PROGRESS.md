# IssueHub - Project Progress

## Current Phase: Phase 5

## Phase Status

| Phase | Status | Stories | Description |
|-------|--------|---------|-------------|
| **Phase 0** | ✅ Done | — | Planning, architecture, documentation, user stories |
| **Phase 1** | ✅ Done | T-01, S-01~S-05 | Task CRUD, list status config, Board + List views |
| **Phase 2** | ✅ Done | T-02~T-05, A-01~A-03, A-05 | Subtasks, dependencies, promote, audit trail, comments |
| **Phase 3** | ✅ Done | C-01~C-03, S-04, S-06 | Custom fields, status mapping, list templates |
| **Phase 4** | ✅ Done | A-02 (real-time) | WebSocket real-time, @mention notifications |
| **Phase 5** | ⏳ Not Started | M-05, M-06, M-08 | Multi-assignee, reviewer, My Tasks page |
| **Phase 6** | ⏳ Not Started | C-04, C-05, A-04 | Custom field filtering, role-based field visibility, attachments & links |
| **Phase 7** | ⏳ Not Started | M-01, M-03, M-04 | Teams, team roles, list visibility by team |
| **Phase 8** | ⏳ Not Started | M-07 | Workload view, full-text search, bulk ops, export, analytics |
| **Later** | ⏳ Deferred | M-02 | Email invite flow — needs SMTP infra, do when deploying for real users |

## Phase 1 Checklist

### Backend
- [x] Docker Compose setup (PostgreSQL, Redis, FastAPI)
- [x] Alembic + initial schema migration
- [x] Core models: User, Workspace, Project, List, ListStatus, Task (with SoftDeleteMixin)
- [x] Google OAuth (authlib) + JWT issue/refresh
- [x] Workspace & Project CRUD
- [x] List CRUD + status management (create, reorder, mark complete)
- [x] Task CRUD endpoints

### Frontend
- [x] Vite + React + TypeScript scaffold
- [x] Google OAuth login page
- [x] Workspace / Project navigation
- [x] Board view (kanban columns by status)
- [x] List view (table rows)
- [x] Task detail page (view/edit)

## Phase 2 Checklist

### Backend
- [x] Subtasks — create, list (ltree path)
- [x] Task dependencies — blocked by / blocking
- [x] Promote subtask to top-level task
- [x] Audit trail — log and display task history with actor name
- [x] Comments — create, list, delete, @mention resolution
- [x] Backend test suite — 67 tests, all passing

### Frontend
- [x] Subtask tree on task detail
- [x] Dependency badges (blocked by / blocking)
- [x] Promote button
- [x] History timeline (audit log with actor name)
- [x] Comments section with @mention hint and delete

## UI
- [x] Full visual overhaul — slate/violet design system
- [x] Two-column task detail layout
- [x] Grid workspace/project cards with initials avatars
- [x] Pill view toggles (List ↔ Board), priority dot indicators
- [x] Colored drag-over highlight on board

## Phase 3 Checklist

### Backend
- [x] Custom field definitions model + migration (0005)
- [x] Custom field values model (UniqueConstraint on task_id+field_id)
- [x] List templates model + migration (0006)
- [x] Custom fields feature: schemas, repository (upsert via ON CONFLICT), service, router
- [x] List templates feature: schemas, repository, service, router
- [x] Required field validation (422 with missing field names)
- [x] Endpoints: GET/POST/PATCH/DELETE /lists/{id}/custom-fields, GET/PUT /tasks/{id}/field-values
- [x] Endpoints: GET/POST /workspaces/{id}/list-templates, DELETE /workspaces/{id}/list-templates/{id}
- [x] Endpoint: POST /projects/{id}/lists/from-template
- [x] Registered both routers in main.py
- [x] Updated conftest.py (model imports + truncate order)
- [x] 11 custom fields tests, 5 list templates tests — all passing (83 total, all green)

### Frontend
- [x] `api/customFields.ts` — field definition + field value hooks
- [x] `api/listTemplates.ts` — list template hooks
- [x] `views/list/ListSettingsPage.tsx` — Statuses tab + Custom Fields tab
- [x] `views/list/ListPage.tsx` — Settings link in header
- [x] `router/index.tsx` — /settings route added
- [x] `views/task/TaskDetailPage.tsx` — Custom Fields card in left column
- [x] `views/project/ProjectPage.tsx` — Templates section + from-template list creation

## Phase 4 Checklist

### Backend
- [x] WebSocket connection manager (Redis Pub/Sub broadcast)
- [x] Task update events — broadcast on PATCH /tasks/{id}
- [x] Notification model + migration (0008)
- [x] Notification endpoints: GET /users/me/notifications, PATCH (mark read), unread-count
- [x] Trigger notifications on: @mention in comment
- [x] pubsub.py helpers — publish_task_event / publish_list_event
- [x] 6 notification tests — all passing (89 total)

### Frontend
- [x] WebSocket client hook (useTaskSocket + useListSocket)
- [x] Live task updates on board/list view without refresh
- [x] Notification bell in header with unread count badge
- [x] Notification dropdown (mark read, mark all read, link to task)
- [x] NotificationBell added to WorkspacePage, ProjectPage, ListPage, BoardPage

## Phase 5 Checklist — Multi-Assignee, Reviewer, My Tasks (M-05, M-06, M-08)

### Backend
- [ ] `Task.assignee_ids UUID[]` column + migration
- [ ] `Task.reviewer_id UUID FK → User` column + migration
- [ ] `PATCH /tasks/{id}` accepts `assignee_ids` and `reviewer_id`; writes audit entries on change
- [ ] `GET /api/v1/me/tasks` — tasks where current user is in `assignee_ids`, filterable by status/priority/due_before
- [ ] Tests for assignee, reviewer, and My Tasks endpoints

### Frontend
- [ ] Assignee multi-select on task detail (workspace members, avatar chips)
- [ ] Reviewer selector on task detail
- [ ] `MyTasksPage` — cross-list task list grouped by list or due date
- [ ] Nav link to My Tasks in workspace sidebar

## Currently Working On
- Planning Phase 5 (M-05, M-06, M-08)

## Completed Tasks
All completed tasks are logged in `docs/PROGRESS-COMPLETED.md`.

## Notes
- Every mutating backend endpoint must call `await session.commit()` — see `docs/BACKEND.md`
