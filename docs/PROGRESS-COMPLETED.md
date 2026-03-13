# IssueHub - Completed Tasks

> **Format:** Sorted by phase ascending (oldest first). Each phase is one section — append new entries to the relevant phase block.

---

## Pre-Development — Planning & Documentation
_Completed: 2026-03-12_

### Architecture Planning
- [x] Defined system architecture (React + FastAPI + PostgreSQL + Redis)
- [x] Designed data model — all core entities, relationships, indexes (see `docs/DATA_MODEL.md`)
- [x] Defined API structure — all endpoint groups and conventions
- [x] Chose PostgreSQL `ltree` for task tree (over recursive CTEs)
- [x] Chose float fractional indexing for drag-drop ordering
- [x] Designed Redis Pub/Sub + WebSocket real-time architecture
- [x] Defined implementation phases

### Documentation
- [x] Created `CLAUDE.md` — project overview, conventions, doc index
- [x] Created `PROGRESS.md` — phase tracker and per-phase checklist
- [x] Created `docs/BACKEND.md`, `docs/FRONTEND.md`, `docs/AUTH.md`, `docs/RBAC.md`
- [x] Created `docs/DATA_MODEL.md`, `docs/REALTIME.md`, `docs/DEPLOYMENT.md`, `docs/PROJECT_STRUCTURE.md`

### User Stories
- [x] T-01 ~ T-05: Task CRUD, subtasks, blockers, promotion (`docs/stories/TASKS.md`)
- [x] A-01 ~ A-05: Audit trail, comments, @mention, attachments (`docs/stories/AUDIT.md`)
- [x] C-01 ~ C-05: Custom fields, required fields, role visibility (`docs/stories/CUSTOM_FIELDS.md`)
- [x] S-01 ~ S-06: Per-list statuses, kanban, cross-list mapping, templates (`docs/stories/STATUS.md`)
- [x] M-01 ~ M-04: Organization, Team hierarchy, Space/List visibility (`docs/stories/ORG_TEAM.md`)
- [x] M-05 ~ M-08: Multi-assignee, My Tasks, workload view, reviewer role (`docs/stories/ASSIGNEE.md`)

---

## Phase 1 — Task CRUD, Status Config, Board + List Views
_Completed: 2026-03-12_

### Backend
- [x] `docker-compose.yml` — PostgreSQL 16, Redis 7, FastAPI, Vite services
- [x] `backend/app/core/` — config, database (async SQLAlchemy), redis, security (JWT)
- [x] `backend/app/models/` — base (SoftDeleteMixin, TimestampMixin), User, Workspace, WorkspaceMember, Project, List, ListStatus, Task (ltree path)
- [x] `backend/alembic/` — initial migration (0001): all tables, ltree extension, GiST index on path
- [x] `backend/app/features/auth/` — Google OAuth router, service (upsert user), schemas
- [x] `backend/app/features/workspaces/` — full CRUD + member management (invite, role update, remove)
- [x] `backend/app/features/projects/` — full CRUD scoped to workspace
- [x] `backend/app/features/lists/` — full CRUD + status management (create, update, reorder, soft delete)
- [x] `backend/app/features/tasks/` — full CRUD with ltree path, fractional order_index, filters

### Frontend
- [x] Vite + React + TypeScript + TanStack Query v5 + Zustand + React Router v6 + Tailwind scaffold
- [x] `api/client.ts` — Axios with JWT Bearer interceptor + 401 auto-refresh
- [x] `store/authStore.ts` — user, accessToken, setUser, setAccessToken, logout
- [x] `views/auth/` — Google OAuth login page + callback handler
- [x] `views/workspace/WorkspacePage.tsx` — list + create workspaces
- [x] `views/project/ProjectPage.tsx` — list + create projects + lists per project
- [x] `views/list/ListPage.tsx` — table view: create/delete tasks, status + priority columns
- [x] `views/board/BoardPage.tsx` — kanban columns by status, HTML5 drag-drop
- [x] `views/task/TaskDetailPage.tsx` — inline title edit, status/priority picker, description, delete

### UI Visual Overhaul
- [x] Slate/violet design system across all pages
- [x] Two-column task detail layout (left: title/desc/subtasks/deps, right: status/priority/history/comments)
- [x] Grid workspace/project cards with initials avatars
- [x] Pill view toggles (List ↔ Board), priority dot indicators, colored drag-over highlight on board

---

## Phase 2 — Subtasks, Dependencies, Promote, Audit Trail, Comments
_Completed: 2026-03-12_

### Backend
- [x] Subtasks — create, list (ltree path), tree query
- [x] Task dependencies — blocked by / blocking (TaskDependency table)
- [x] Promote subtask to top-level task (atomic, ltree prefix replacement)
- [x] Audit trail — AuditLog append-only table; log all field changes with actor + timestamp
- [x] Comments — create, list (with author JOIN), delete, @mention resolution
- [x] `WorkspaceRepository.list_member_users()` — for @mention resolution
- [x] Migrations: 0002 (audit_log), 0003 (task_dependencies), 0004 (comments)
- [x] Backend test suite — 67 tests, all passing

### Frontend
- [x] Subtask tree on task detail with collapse/expand
- [x] Dependency badges (blocked by / blocking) with add/remove
- [x] Promote button on subtask detail
- [x] History timeline (audit log with actor name, status name resolution)
- [x] History section collapsed to 5 entries with "Show N more / Show less" toggle
- [x] Comments section (above history) — post, delete, author name display, @mention autocomplete

---

## Phase 3 — Custom Fields, Status Mapping, List Templates
_Completed: 2026-03-12_

### Backend
- [x] `CustomFieldDefinition` + `CustomFieldValue` models + migration (0005)
- [x] `ListTemplate` model + migrations (0006, 0007 — adds `default_custom_fields` JSONB)
- [x] Custom fields feature: schemas, repository (ON CONFLICT upsert), service (required field 422), router (6 endpoints)
- [x] List templates feature: create/list/delete/update templates; `POST /projects/{id}/lists/from-template`
- [x] `PATCH /workspaces/{id}/list-templates/{id}` — update name, statuses, custom fields
- [x] `create_list_from_template` uses `session.add_all()` bulk insert (N+1 fix)
- [x] Audit log resolves `status_id` → status name
- [x] 11 custom field tests + 5 list template tests — 83 total, all passing

### Frontend
- [x] `api/customFields.ts` — field definition + field value hooks
- [x] `api/listTemplates.ts` — list template hooks (create, update, delete, from-template)
- [x] `views/list/ListSettingsPage.tsx` — two-tab page: Statuses + Custom Fields
- [x] `views/workspace/WorkspaceSettingsPage.tsx` — dedicated templates page at `/workspaces/:id/settings`; inline status + field editor per template
- [x] `views/task/TaskDetailPage.tsx` — Custom Fields card (all 6 types: text, number, date, dropdown, checkbox, url)
- [x] `views/project/ProjectPage.tsx` — from-template list creation (Blank | From template toggle); "⚙ Templates" header link

---

## Phase 4 — WebSocket Real-Time, @Mention Notifications
_Completed: 2026-03-13_

### Backend
- [x] `app/core/pubsub.py` — `publish_task_event` / `publish_list_event` helpers (best-effort)
- [x] `app/models/notification.py` — Notification model (user_id, task_id, type, body, is_read, meta JSONB)
- [x] Migration 0008 — notifications table with index on user_id
- [x] `app/features/notifications/` — full module: schemas, repository, router (list, unread-count, mark-read, mark-all-read)
- [x] `app/features/websocket/` — Redis `psubscribe("task:*", "list:*")` fan-out; `/ws/tasks/{id}` + `/ws/lists/{id}`
- [x] `app/main.py` — lifespan starts `redis_listener`; registers notifications + websocket routers
- [x] `tasks/router.py` — publishes `task.updated` event after PATCH
- [x] `comments/router.py` — publishes `task.comment_added`; creates mention notifications
- [x] `comments/service.py` — fixed `_resolve_mentions`: direct `"@<display_name>" in body` check (replaced greedy regex)
- [x] 7 notification tests — all passing (90 total)

### Frontend
- [x] `api/notifications.ts` — `useNotifications`, `useUnreadCount` (30s poll), `useMarkRead`, `useMarkAllRead`
- [x] `hooks/useTaskSocket.ts` — `useTaskSocket` + `useListSocket` (invalidate queries on WS event)
- [x] `components/NotificationBell.tsx` — bell + unread badge, dropdown with 20 recent, mark all read
- [x] `components/HeaderActions.tsx` — NotificationBell + logout icon on every page
- [x] `views/task/TaskDetailPage.tsx` — `useTaskSocket` for live updates; @mention autocomplete in comment form
- [x] `api/comments.ts` — `onSuccess` invalidates notification queries so self-mentions appear immediately

---

## Phase 5 — Multi-Assignee, Reviewer, My Tasks (M-05, M-06, M-08)
_Completed: 2026-03-13_


### Backend
- [x] `assignee_ids UUID[]` + `reviewer_id UUID FK` — already in initial migration
- [x] `_UNSET` sentinel in `UpdateTaskDTO` so `reviewer_id=None` clears the field (not ignored)
- [x] `list_my_tasks()` in `TaskRepository` — filters by `assignee_ids` array using `any_()`
- [x] `list_my_tasks()` in `TaskService` — workspace member guard
- [x] `GET /api/v1/workspaces/{workspace_id}/me/tasks` — filterable by status/priority
- [x] 8 tests in `tests/test_assignee.py` — all passing

### Frontend
- [x] `TaskDetailPage`: Assignee chips (avatar initials + remove); dropdown to add workspace members
- [x] `TaskDetailPage`: Reviewer selector with "Remove" to clear; `reviewer_id: null` supported
- [x] `TaskDetailPage`: invalidates `['tasks', list_id]` on update so list reflects changes immediately
- [x] `ListPage`: Assignees column (overlapping avatar circles, up to 4 + overflow) + Reviewer column
- [x] `MyTasksPage` at `/workspaces/:id/my-tasks` — cross-list tasks grouped by overdue / upcoming / no due date
- [x] "My Tasks" nav link in workspace (ProjectPage) header

---

## Phase 6 — Custom Field Filtering, Role Visibility, Task Links (C-04, C-05, A-04)
_Completed: 2026-03-13_

### Backend
- [x] C-04: `cf[field_id]=value` query param filtering in `GET /lists/{id}/tasks` — text ilike, number exact, dropdown selected
- [x] C-05: `visibility_roles TEXT[]` + `editable_roles TEXT[]` on `CustomFieldDefinition` — migration 0009; `list_fields` filters by role; `upsert_task_values` rejects 403 if caller's role not in `editable_roles`
- [x] A-04: `TaskLink` model + migration 0010; `/tasks/{id}/links` (POST 201, GET, DELETE 204); audit log entries `link_added` / `link_removed`
- [x] Fix: workspace `invite_member` / `update_member_role` responses look up `User.display_name` for `MemberResponse` (was 500)
- [x] 108 tests — all passing

### Frontend
- [x] `api/links.ts` — `useTaskLinks`, `useAddLink`, `useDeleteLink` hooks
- [x] `TaskDetailPage`: Links card — add URL + optional title, clickable links, delete
- [x] Fix: `useAddLink` now invalidates audit cache so history updates immediately after adding a link
- [x] Fix: `link_added` / `link_removed` history entries hide URL details — show action name only
- [x] Fix: `api/links.ts` used default import for `apiClient` (caused blank screen) — corrected to named import
