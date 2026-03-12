# IssueHub - Project Progress

## Current Phase: Phase 4

## Phase Status

| Phase | Status | Description |
|-------|--------|-------------|
| **Phase 0** | ✅ Done | Planning, architecture, documentation, user stories |
| **Phase 1** | ✅ Done | Task CRUD, list status config, Board + List views |
| **Phase 2** | ✅ Done | Subtasks, dependencies, promote, audit trail, comments |
| **Phase 3** | ✅ Done | Custom fields, status mapping, list templates |
| **Phase 4** | 🔄 In Progress | WebSocket real-time, notifications |
| **Phase 5** | ⏳ Not Started | Full-text search, bulk ops, export, analytics |
| **Phase 6** | ⏳ Not Started | Teams + team roles (M-01, M-03) — no email invite |
| **Phase 7** | ⏳ Not Started | List visibility by team (M-04), multi-assignee & workload (M-05~M-08) |
| **Later** | ⏳ Deferred | Email invite flow (M-02) — needs SMTP infra, do when deploying for real users |

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
- [ ] WebSocket connection manager (Redis Pub/Sub broadcast)
- [ ] Task update events — broadcast on PATCH /tasks/{id}
- [ ] Notification model + migration
- [ ] Notification endpoints: GET /users/me/notifications, PATCH (mark read)
- [ ] Trigger notifications on: @mention in comment, task assigned to you, blocked task unblocked

### Frontend
- [ ] WebSocket client hook (useTaskSocket)
- [ ] Live task updates on board/list view without refresh
- [ ] Notification bell in header with unread count
- [ ] Notification dropdown (mark read, link to task)

## Currently Working On
- Starting Phase 4 — WebSocket real-time + notifications

## Completed Tasks
All completed tasks are logged in `docs/PROGRESS-COMPLETED.md`.

## Notes
- Every mutating backend endpoint must call `await session.commit()` — see `docs/BACKEND.md`
