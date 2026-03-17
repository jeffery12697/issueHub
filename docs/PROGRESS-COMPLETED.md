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
- [x] Slate/violet design system across all pages; two-column task detail layout; grid workspace/project cards with initials avatars; pill view toggles, priority dot indicators

---

## Phase 2 — Subtasks, Dependencies, Promote, Audit Trail, Comments
_Completed: 2026-03-12_

### Backend
- [x] Subtasks — create, list (ltree path), tree query
- [x] Task dependencies — blocked by / blocking (`TaskDependency` table)
- [x] Promote subtask to top-level task (atomic, ltree prefix replacement)
- [x] Audit trail — `AuditLog` append-only table; log all field changes with actor + timestamp
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
- [x] `views/workspace/WorkspaceSettingsPage.tsx` — templates page at `/workspaces/:id/settings`; inline status + field editor per template
- [x] `views/task/TaskDetailPage.tsx` — Custom Fields card (all 6 types: text, number, date, dropdown, checkbox, url)
- [x] `views/project/ProjectPage.tsx` — from-template list creation (Blank | From template toggle)

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
- [x] "My Tasks" nav link in workspace header

---

## Phase 6 — Custom Field Filtering, Role Visibility, Task Links (C-04, C-05, A-04)
_Completed: 2026-03-13_

### Backend
- [x] C-04: `cf[field_id]=value` query param filtering in `GET /lists/{id}/tasks` — text ilike, number exact, dropdown selected
- [x] C-05: `visibility_roles TEXT[]` + `editable_roles TEXT[]` on `CustomFieldDefinition` — migration 0009; `list_fields` filters by role; `upsert_task_values` rejects 403 if caller's role not in `editable_roles`
- [x] A-04: `TaskLink` model + migration 0010; `/tasks/{id}/links` (POST 201, GET, DELETE 204); audit log entries `link_added` / `link_removed`
- [x] Fix: workspace `invite_member` / `update_member_role` responses look up `User.display_name` for `MemberResponse` (was 500)
- [x] Validation: only one `is_complete` status allowed per list — returns 422 if another Done status already exists
- [x] 108 tests — all passing

### Frontend
- [x] `api/links.ts` — `useTaskLinks`, `useAddLink`, `useDeleteLink` hooks
- [x] `TaskDetailPage`: Links card — add URL + optional title, clickable links, delete
- [x] Fix: `useAddLink` invalidates audit cache so history updates immediately after adding a link
- [x] Fix: `link_added` / `link_removed` history entries show action name only (not raw URL diff)
- [x] Fix: `api/links.ts` corrected to named import for `apiClient` (was causing blank screen)
- [x] C-04 + ListPage: Status and Priority filter dropdowns added to filter bar (server-side filtering)

---

## Phase 7 — Teams, Team Roles, List Visibility (M-01, M-03, M-04)
_Completed: 2026-03-13_

### Backend
- [x] `Team` + `TeamMember` models with `SoftDeleteMixin` + `TimestampMixin`; `TeamRole` enum: `team_admin`, `team_member`
- [x] Migration 0011: creates `teams`, `team_members` tables and adds `team_ids UUID[]` to `lists`
- [x] `app/features/teams/` module: `schemas.py`, `repository.py`, `service.py`, `router.py`
- [x] Endpoints: `POST/GET /workspaces/{id}/teams`, `DELETE .../teams/{id}`, `POST/GET/DELETE .../teams/{id}/members`
- [x] `PATCH /lists/{list_id}/visibility` — sets `team_ids` on a list (owner/admin only)
- [x] `list_for_project` filters out restricted lists for non-admin members; workspace owner/admin bypass
- [x] 10 tests in `test_teams.py` — all passing

### Frontend
- [x] `api/teams.ts` — `teamsApi`, `useTeams`, `useTeamMembers`, `useCreateTeam`, `useDeleteTeam`, `useAddTeamMember`, `useRemoveTeamMember`
- [x] `api/lists.ts` — added `team_ids: string[]` to `List` type; added `setVisibility` method
- [x] `WorkspaceSettingsPage.tsx` — refactored into Members + Teams + Templates tabs; Teams tab: list/create/delete teams, per-team member management (add/remove, role select)
- [x] `ListSettingsPage.tsx` — added Visibility tab; multi-select checkboxes for team access restriction
- [x] `ProjectPage.tsx` — "⚙ Settings" link in workspace header

---

## Post-Phase-7 Ad-hoc Improvements
_Completed: 2026-03-13_

### Auth & Security
- [x] Dev login endpoint (`POST /dev/token?email=&display_name=`) — creates/fetches user + JWT; gated by `settings.allow_dev_login` (env `ALLOW_DEV_LOGIN`, default `true`)
- [x] `LoginPage.tsx` — "Dev login" toggle shows email + display_name form; reads `VITE_ALLOW_DEV_LOGIN` flag
- [x] `qc.clear()` on logout in `HeaderActions.tsx` — wipes TanStack Query cache so next user sees fresh data

### Workspace Member Management
- [x] `GET /auth/users/search?email=` — find user by exact email (any authenticated user)
- [x] `invite_member` restricted to `owner` role only (admins no longer allowed to invite)
- [x] `WorkspaceSettingsPage.tsx` — Members tab (default): search by email → preview → pick role → Add; current members with role selector + remove button
- [x] `api/workspaces.ts` — added `inviteMember`, `updateMemberRole`, `removeMember`, `searchUser`; corresponding hooks

### UI / UX
- [x] `TaskDetailPage.tsx` full redesign — 2-column layout: left (title, description, tabbed Subtasks/Dependencies/Links/Fields, Comments, History); right sidebar `w-64` (Status pills, Priority dots, Assignees, Reviewer)
- [x] `ListPage.tsx` filter bar redesign — pill-shaped `FilterSelect` component (`appearance-none` + custom chevron), active violet highlight, ✕ Clear button
- [x] `docs/FRONTEND.md` updated — TaskDetailPage layout, ListPage filter bar, member management, dev login sections

---

## Phase 8 — Workload View, Full-Text Search, Bulk Ops, Export, Analytics
_Completed: 2026-03-13_

### Backend
- [x] **Export CSV**: `GET /lists/{id}/tasks/export` — streams CSV (id/title/status/priority/assignees/created_at); resolves status names and assignee display names
- [x] **Full-text search**: `TaskRepository.search()` — ILIKE on title + description; `GET /workspaces/{id}/search?q=`; empty/short query returns `[]`; workspace-member gated
- [x] **Bulk update**: `POST /tasks/bulk-update` — `BulkUpdateRequest` (task_ids + optional status_id/priority); `TaskRepository.bulk_update()` uses `update().where(Task.id.in_(ids))`
- [x] **Bulk delete**: `POST /tasks/bulk-delete` — `TaskRepository.bulk_soft_delete()` sets `deleted_at` for all matched IDs
- [x] **Workspace analytics**: `GET /workspaces/{id}/analytics` — total task count, overdue count, tasks grouped by status with resolved names + story points; returns `AnalyticsResponse`
- [x] **Workload view**: `GET /workspaces/{id}/workload` — per-member open task list; returns `list[MemberWorkloadResponse]`
- [x] 19 tests across `test_export.py`, `test_search.py`, `test_bulk.py`, `test_analytics.py`, `test_workload.py` — all passing

### Frontend
- [x] `api/tasks.ts` — added `exportCsv(listId)` (blob download), `search(workspaceId, q)`, `bulkUpdate`, `bulkDelete`
- [x] `api/workspaces.ts` — `getAnalytics`, `getWorkload`; `useAnalytics`, `useWorkload` hooks; `AnalyticsResponse`, `MemberWorkloadResponse` types
- [x] `components/GlobalSearch.tsx` — debounced search input (300ms), dropdown overlay, Escape/click-outside to close, navigates to `/tasks/:id`
- [x] `views/workspace/AnalyticsPage.tsx` — stat cards (total, overdue, status count, story points), CSS bar chart for tasks-by-status breakdown
- [x] `views/workspace/WorkloadPage.tsx` — per-member cards with avatar, task count + SP badge, collapsible task list
- [x] `views/list/ListPage.tsx` — checkbox column, `selectedIds` state, sticky bulk action bar (status/priority selects + Delete), "⬇ Export CSV" button
- [x] Router — added `/workspaces/:id/analytics` and `/workspaces/:id/workload` routes

### UI Polish
- [x] `WorkspaceHeader` — shared header component (Projects / My Tasks / Workload / Analytics nav tabs, GlobalSearch, settings icon); h-14 → h-16, nav text-sm, workspace name text-base
- [x] `WorkspacePage` — greeting h1 text-3xl, workspace card avatars w-14, card name text-base font-bold; polished empty state with CTA
- [x] `ProjectPage` — page title text-2xl, project name text-base font-bold, list names text-base; uses shared `WorkspaceHeader`
- [x] `ListPage` — page title text-2xl + task count subtitle; table rows py-4; task title text-base font-semibold; filter pills h-9/text-sm; empty state with CTA
- [x] `HeaderActions` — user avatar w-7, sign-out icon 18px; shown on every page
- [x] `MyTasksPage`, `WorkloadPage`, `AnalyticsPage` — all use `WorkspaceHeader`; page title + subtitle, skeleton loaders, polished empty states
- [x] Fix: missing `Link` import in `ProjectPage` after header refactor (caused blank page)
- [x] Fix: `react-hot-toast` import in `ListPage` replaced with project's `@/store/toastStore`

---

## Post-Phase-8 Improvements
_Completed: 2026-03-13_

### Backend
- [x] **Move task (S-04)**: `PATCH /tasks/{id}/move` — clears `status_id`, updates `list_id`/`project_id`/`workspace_id`, writes `moved` audit entry
- [x] `GET /workspaces/{id}/lists` — flat list of all lists in workspace (for move-to-list selector)

### Frontend
- [x] **Due date column in ListPage** — overdue (red ⚠), due today (amber "Today"), completed (plain grey), no date (—)
- [x] **Due date picker in TaskDetailPage** — date input in right sidebar reads/writes `task.due_date`
- [x] **Move to List** — "Move to List" dropdown in TaskDetailPage sidebar shows all other lists in workspace
- [x] **English locale for all dates** — all `toLocaleDateString`/`toLocaleString` calls use `'en-US'`
- [x] **DeleteButton component** — confirm modal (warning icon, context message, Cancel + Delete) with icon/text/button variants; replaces all bare text deletes and `window.confirm()` calls
- [x] **History assignee/reviewer names** — `HistorySection` receives `memberMap`; `reviewer_id` / `assignee_ids` resolved to display names; field labels strip `_id` suffix

---

## Phase 9 — Notifications & Watchers (N-01, N-03)
_Completed: 2026-03-13_

### Backend
- [x] `TaskWatcher` model + migration; `POST/DELETE/GET /tasks/{id}/watch`
- [x] Watchers receive `task_updated` notification on task updates and new comments (actor excluded)
- [x] `assigned` notification sent to newly added assignees
- [x] @mention notifications confirmed working via comment creation service
- [x] N-02 (`immediate/digest` preference) deferred — requires SMTP infrastructure
- [x] 8 backend tests all passing

### Frontend
- [x] Watch/Unwatch button in TaskDetailPage sidebar
- [x] Watcher and assignee notifications visible in NotificationBell dropdown

---

## Phase 10 — Time Management (TM-01, TM-03, TM-04)
_Completed: 2026-03-13_

### Backend
- [x] **TM-01 start_date** — migration 0013 adds `start_date` column to tasks; model, schemas (CreateTaskDTO, UpdateTaskDTO, TaskResponse), repository create/update all updated
- [x] **TM-04 story_points** — migration 0013 adds `story_points` column to tasks; same schema/repo plumbing
- [x] **TM-03 time tracking** — migration 0014 creates `time_entries` table; `TimeEntry` model; full CRUD (`repository.py`, `schemas.py`, `router.py`); `POST/GET /tasks/{id}/time-entries`, `DELETE /tasks/{id}/time-entries/{entry_id}`; ownership check (403 for other users' entries)
- [x] 11 backend tests all passing (`tests/test_time_entries.py`)

### Frontend
- [x] TaskDetailPage sidebar: Start Date picker, Story Points input
- [x] New Time tab: log form (minutes + optional note), entry list with formatted duration (e.g. "1h 30m"), per-entry delete
- [x] `api/timeEntries.ts` — `useTimeEntries`, `useLogTime`, `useDeleteTimeEntry`
- [x] `start_date` / `story_points` added to Task type in `api/tasks.ts`
- [x] Workload API returns `total_story_points` per member; badge shows "X tasks · Y SP"; SP-based load color thresholds (≥20 red, ≥10 amber)
- [x] Analytics story points — SP summed per status group and as workspace total; Story Points stat card (violet); per-status SP in Tasks by Status bar chart

---

## Phase 11 — Auto-Close Parent Task (AU-03)
_Completed: 2026-03-13_

- [x] `maybe_close_parent()` in tasks router — after any subtask status update, checks if all siblings have `is_complete=True`; finds first complete status in parent's list and applies it; writes `auto_closed` audit log; skips if parent already closed or list has no complete status
- [x] 5 backend tests passing

### Post-Phase-11 Polish
- [x] **Subtask depth enforcement** — `create_subtask` service raises HTTP 400 if `parent.depth > 0`
- [x] **Subtasks in list page** — `include_subtasks=true` param on list endpoint; ListPage groups parent tasks + subtasks interleaved; subtask rows indented (`pl-10`) with `↳ Parent title` clickable breadcrumb
- [x] **Board UI/UX redesign** — full rewrite of `BoardPage.tsx`: color accent bars, priority/SP/due date badges on cards, assignee avatar stack, subtask count; SP total + colored count badge in column header; drag-drop drop zone highlight; inline "Add task" form per column; "No Status" column
- [x] **Rich text editor** — Tiptap editor (`RichTextEditor.tsx`) with full toolbar (Bold, Italic, Underline, Strike, Code, H1/H2/H3, Bullet/Ordered/Task lists, Blockquote, Code block, HR, Undo/Redo); saves on `onBlur`; description history shows "edited" instead of raw HTML diff
- [x] **Task list pagination** — `list_for_list` returns `(tasks, total)` tuple; router accepts `page`/`page_size` (default 0 = all); sets `X-Total-Count` header exposed via CORS; ListPage uses page_size=50, prev/next + numbered page buttons
- [x] **Blocked/Blocking badges** — `GET /lists/{list_id}/task-dependencies` batch endpoint; `DependencyRepository.get_dependency_flags()` runs two `SELECT DISTINCT` queries; ListPage shows red ⛔ Blocked / amber ⚠ Blocking badges next to task title

---

## Phase 12 — Advanced Automation (AU-01)
_Completed: 2026-03-14_

- [x] `Automation` model + migration 0015; `trigger_type` (`status_changed`, `priority_changed`) + `trigger_value`; `action_type` (`set_status`, `set_priority`, `assign_reviewer`, `clear_assignees`) + `action_value`
- [x] `AutomationRepository`, `AutomationService`, `AutomationRouter` — `GET/POST /lists/{id}/automations`, `DELETE /automations/{id}`; owner/admin only for create/delete
- [x] `AutomationRepository` injected into `TaskService`; `_run_automations()` evaluates rules after every update using raw `status_id` UUID (before name conversion) and writes `automation` audit log entry
- [x] 13 backend tests all passing (`tests/test_automations.py`)
- [x] Frontend: `api/automations.ts`; "Automations" tab in `ListSettingsPage` — rule list as human-readable sentences, create form with trigger/action dropdowns, delete per rule

---

## Project Tasks Cross-List View
_Completed: 2026-03-14_

- [x] **Backend**: `TaskRepository.list_for_project()` — filters by `project_id`, supports `list_id`/`priority`/`assignee_id`/`include_subtasks`, pagination, orders by `list_id, order_index`; `TaskService.list_for_project()` with 404 + workspace member check; `GET /projects/{project_id}/tasks` with `X-Total-Count` header
- [x] **Frontend**: `tasksApi.listForProject()` in `tasks.ts`; `ProjectTasksPage.tsx` at `/projects/:projectId` — filter bar (list/priority/subtasks), task table (title, list badge, status pill, priority dot, assignee avatars, reviewer, due date), pagination; project name links to `/projects/:projectId`, list hover actions include "All Tasks" link
- [x] **UI unification** — `ProjectTasksPage` rewritten to match `ListPage` exactly: `<table>`, `FilterSelect` pill components, colored status badge, `AvatarStack`/`Avatar`, `DueDateBadge` (Asia/Taipei boundary), reviewer column, dashed empty state, `max-w-5xl`
- [x] 7 backend tests all passing (`tests/test_project_tasks.py`)

---

## RBAC Hardening & Project Analytics
_Completed: 2026-03-14_

### Workspace & List Settings Restricted to Owner/Admin
- [x] **Backend** — `ListTemplateService`: `create_template`, `update_template`, `delete_template` now require owner/admin via `_require_admin` (previously any member); `CustomFieldService`: `create_field`, `update_field`, `delete_field` require owner/admin via `_require_list_admin`
- [x] **Frontend** — `WorkspaceHeader.tsx`: settings gear icon hidden for members; `WorkspaceSettingsPage.tsx`: access-denied message for members who navigate directly to the URL; template queries skipped for non-admin users; `ListPage.tsx`: ⚙ Settings link hidden for members via `canManageSettings` flag

### Project-Level Analytics
- [x] **Backend** — `TaskRepository.analytics_for_project(project_id)`: total tasks, overdue count, tasks grouped by status with story points; `GET /projects/{project_id}/analytics` endpoint (workspace member check, resolves status names); reuses `AnalyticsResponse` + `StatusCount` schemas from workspaces
- [x] **Frontend** — `useProjectAnalytics` hook + `ProjectAnalytics` type in `api/projects.ts`; `ProjectAnalyticsPage.tsx` at `/projects/:projectId/analytics` — stat cards (Total Tasks, Overdue, Statuses, Story Points) and Tasks by Status bar chart; project-level nav tabs (All Tasks | Analytics) in both `ProjectTasksPage` and `ProjectAnalyticsPage` headers matching workspace nav pattern; "Analytics" link added to project card hover actions in `ProjectPage.tsx`

---

## Sequential Task IDs & Blocker Search
_Completed: 2026-03-14_

### Sequential Task IDs (DEV-0001 style)
- [x] **Backend** — `task_prefix` (String 10, default "TSK") + `next_task_number` (Integer, default 1) added to `Project` model; `task_number` + `task_key` (indexed) added to `Task` model; migration 0016 with Python-side backfill (generates prefix from name, assigns sequential numbers per project ordered by `created_at`)
- [x] `ProjectRepository.claim_task_number()` — atomic `UPDATE ... RETURNING` increment (single round-trip, concurrency-safe)
- [x] `TaskService.create()` + `create_subtask()` — call `claim_task_number`, build `task_key = f"{prefix}-{n:04d}"`, persist on task
- [x] `ProjectRepository._make_prefix()` — multi-word → initials up to 4 chars; single word → first 4 uppercase alpha chars; fallback "TSK"
- [x] `CreateProjectRequest` / `UpdateProjectRequest` / `ProjectResponse` schemas updated with `task_prefix`; `TaskResponse` updated with `task_number` + `task_key`
- [x] **Frontend** — `task_key` monospace badge displayed in `ListPage`, `BoardPage`, `TaskDetailPage`, `ProjectTasksPage`; `ProjectPage` create form has `KEY` input (auto-fills from name, max 4 chars, uppercase)

### Blocker Search Dropdown
- [x] Replaced plain "Paste task ID" input with a search dropdown in `TaskDetailPage` dependencies tab
- [x] Project tasks pre-loaded on page open via `tasksApi.listForProject`; filtered live by title or task_key as user types
- [x] Dropdown shows `task_key` + title; selecting a result calls `addBlockedBy.mutate(id)` immediately
- [x] Excludes current task and already-added blockers from results
- [x] Fixed temporal dead zone bug (`addingBlockedBy` state moved before the query that referenced it)
- [x] Fixed `overflow-hidden` on tabs container that was clipping the absolute-positioned dropdown

---

## Post-Phase-12 Ad-hoc Improvements
_Completed: 2026-03-14_

### My Tasks — Project & List Context
- [x] Each task row on `MyTasksPage` now shows a grey project pill and a violet list pill so users can see where the task lives at a glance
- [x] Uses existing `projectsApi.list` + `useWorkspaceLists` hooks; builds lookup maps client-side; no backend changes needed

### Subtasks in Different Lists
- [x] **Backend** — `CreateTaskRequest` accepts optional `list_id`; `TaskService.create_subtask()` uses it if provided, validates it belongs to the same project (400 otherwise), falls back to parent's list
- [x] **Frontend** — subtask form shows a list dropdown when the project has more than one list (defaults to "Same list"); subtask rows show a violet list badge when the subtask is in a different list than the parent
- [x] 2 new backend tests: happy path (subtask in different list) + cross-project rejection

### Email Service (SMTP)
- [x] `app/core/email.py` — async `send_email(to, subject, html)` using `smtplib` + `asyncio.to_thread`; no-op when `MAIL_ENABLED=false` or credentials missing
- [x] `app/core/email_templates.py` — professional HTML templates (dark header, task chip, CTA button) for mention, assignment, watcher, overdue, digest
- [x] `app/core/config.py` — `mail_server`, `mail_port`, `mail_sender_name`, `mail_sender_email`, `mail_username`, `mail_password`, `mail_enabled` settings
- [x] `POST /api/v1/dev/mail/test` — test endpoint to verify SMTP delivery (Mailtrap tested and confirmed working)
- [x] No extra packages — uses Python built-in `smtplib`
- [x] Wired to events via `BackgroundTasks`: @mention in comment, task assignment, watcher on comment, watcher on task update

---

## Phase 13 — Email Invites, Notification Digest, Overdue Notifications
_Completed: 2026-03-15_

### M-02 — Workspace Email Invite Flow
- [x] `WorkspaceInvite` model — `id`, `workspace_id`, `email`, `role`, `token` (URL-safe 32 bytes), `invited_by`, `expires_at` (7 days), `accepted_at`
- [x] Migration `0017_add_workspace_invites.py`
- [x] `invite_email()` template — "You're invited to join {workspace}" with CTA button
- [x] `POST /workspaces/{id}/invites` — owner/admin only, creates invite + sends email via `BackgroundTasks`
- [x] `GET /workspaces/invites/{token}` — public endpoint to read invite details before accepting
- [x] `POST /workspaces/invites/{token}/accept` — authenticated; validates expiry + not-already-accepted; creates `WorkspaceMember`, marks invite accepted
- [x] 6 tests: happy path, 403 for plain members, get-by-token, accept adds member, double-accept 409, bogus token 404

### N-02 — Notification Preferences & Daily Digest
- [x] `notification_preference` column on `User` (`immediate` | `digest`, default `immediate`) — migration `0018`
- [x] `GET /auth/preferences` — returns current preference
- [x] `PATCH /auth/preferences` — validates value, updates and persists immediately
- [x] `NotificationRepository.get_unread_grouped_by_user(since_hours)` — joins `users`, filters by `notification_preference = 'digest'`, groups by `user_id`
- [x] `app/jobs/digest.py` — daily cron at 08:00 Asia/Taipei: emails each digest-preference user their past-24h unread notifications
- [x] `apscheduler==3.10.4` added to `requirements.txt`; `app/core/scheduler.py` holds the `AsyncIOScheduler`
- [x] Scheduler registered in `app/main.py` lifespan
- [x] 5 tests: default immediate, update to digest/back, invalid value 422, digest repo filter

### AU-02 — Overdue Task Auto-Notifications
- [x] `overdue_notified: bool` on `Task` (default `False`) — migration `0019`
- [x] `TaskRepository.get_newly_overdue()` — tasks where `due_date < now` AND `overdue_notified = false` AND not deleted
- [x] `TaskRepository.mark_overdue_notified(task_id)` — sets flag to prevent re-send
- [x] `TaskRepository.update()` — resets `overdue_notified = False` whenever `due_date` is changed
- [x] `app/jobs/overdue.py` — daily cron at 08:00 Asia/Taipei: emails all assignees of newly-overdue tasks using `overdue_email()` template
- [x] 6 tests: past-due found, future excluded, already-notified excluded, mark-notified works, update resets flag, no-due-date excluded

---

## Phase 15 — AU-04: Git Webhook Integration
_Completed: 2026-03-17_

### Backend
- [x] `POST /webhooks/git` endpoint (no `/api/v1` prefix — called by external services)
- [x] Platform detection via headers: GitHub (`X-Hub-Signature-256` HMAC-SHA256) / GitLab (`X-Gitlab-Token` plain token)
- [x] `app/features/webhooks/schemas.py` — Pydantic models for GitHub PR and GitLab MR payloads
- [x] `app/features/webhooks/service.py` — task key extraction regex `[A-Z]+-\d{1,6}` from branch name
- [x] PR/MR opened → write `git_branch_linked` audit entry (no status change)
- [x] PR/MR merged → set task to first `is_complete=true` status; write `status_changed` audit entry with git metadata
- [x] Idempotent: already-complete tasks go to `skipped`; missing task keys go to `errors`; always returns 200
- [x] Migration `0021` — `audit_logs.actor_id` made nullable for system-generated events
- [x] `TaskRepository.get_by_task_key()` — lookup by `task_key` indexed column
- [x] `AuditRepository.log()` accepts `actor_id: UUID | None`; `list_for_task` uses `outerjoin` for null actors
- [x] `AuditLogResponse` schema — `actor_id` and `actor_name` made nullable
- [x] `WEBHOOK_SECRET` added to `Settings` and `.env.example`
- [x] 11 tests: both platforms, signature verification, open/merge/abandon, dedup, unknown key, no key, multiple keys

### Bug Fixes During Testing
- [x] Regex `\b` word boundary removed — underscore-separated branch names (`JEFF-0006_desc`) were not matching
- [x] DB patch: existing `done`-category statuses updated to `is_complete=true`
- [x] `audit/schemas.py` — nullable actor fields fixed (was causing 500 on task page load)

### Frontend
- [x] `api/audit.ts` — `actor_id` and `actor_name` typed as `string | null`
- [x] `TaskDetailPage` history — shows "Git" when `actor_name` is null
- [x] `HistorySection` — filters `val` to only render array entries in `renderChange` (non-array webhook metadata fields were crashing the page)
- [x] `git_branch_linked` action renders branch name inline; excluded from generic change renderer

---

## UI/UX Improvements + Filter Operators + List Visibility Enforcement
_Completed: 2026-03-15_

### Task Detail Page Redesign
- [x] Sticky header with breadcrumb (list name → task key), `sticky top-0 z-20 shadow-sm`
- [x] Title and description in white card section
- [x] Sticky sidebar (`sticky top-20 self-start`) with status/priority popovers (Linear-style)
- [x] Per-priority `PRIORITY_CHIP` badge styling; status button uses inline color from status config
- [x] Comments in card with bubble layout; history with color-coded dots per action type (`ACTION_DOT`)
- [x] `LoadingSkeleton` component with `animate-pulse` divs replacing plain "Loading…"
- [x] 403 Access Denied screen with go-back button for team-restricted tasks

### FilterBar Component
- [x] `frontend/src/components/FilterBar.tsx` — reusable inline filter chip builder
- [x] `FilterRule` type: `{ id, field, op: 'eq'|'neq', value }`; `FilterField` type with optional `ops` restriction
- [x] `ops.length === 1` renders static label instead of operator select
- [x] Wired into `ListPage` (status + priority, both eq/neq) and `ProjectTasksPage` (list eq-only, priority eq/neq)
- [x] Backend: `list_for_list` and `list_for_project` accept `status_ids_not` / `priorities_not` (SQLAlchemy `notin_`)
- [x] Router query params `status_id_not` and `priority_not` parsed as comma-separated values

### List Visibility Enforcement on Project & Task Endpoints
- [x] `TaskService.list_for_project` computes `list_ids_allowed` for non-owner/admin users via `TeamRepository.get_user_team_ids`
- [x] `TaskRepository.list_for_project` applies `.in_(list_ids_allowed)` constraint
- [x] `GET /tasks/{task_id}` calls new `get_or_404_for_user` — checks workspace membership + list team restriction (403 if not in required team)
- [x] Frontend `TaskDetailPage` handles 403 with locked-screen error state; retries disabled for 403/404

---

## UI: Group by Status — List & Project Views
_Completed: 2026-03-17_

### Features
- [x] "⊞ Group by status" toggle button in `ListPage` toolbar (between Export CSV and + New task)
- [x] "⊞ Group by status" toggle button in `ProjectTasksPage` header (top-right)
- [x] Active state: violet tinted button; inactive: bordered/default
- [x] `displayGroups` computed from fetched tasks — frontend-only, no backend changes
- [x] Group header row: colored dot + status name (uppercase) + task count badge
- [x] `ListPage`: groups ordered by list's status `order_index`; parents come first within each group, subtasks follow
- [x] `ProjectTasksPage`: groups ordered by status definition order across all lists; no subtask reordering
- [x] "No Status" group appended at end for tasks with `status_id = null`
- [x] Table rendered via `displayGroups.flatMap(...)` — single task row template used in both flat and grouped modes

---

## Phase 16 — F-01 Global Search, F-02 Saved Views, F-03 Group-by
_Completed: 2026-03-17_

### F-01: Global Search (comment content)
- [x] `TaskRepository.search()` extended with `OR Task.id IN (SELECT task_id FROM comments WHERE body ILIKE ...)` subquery
- [x] Search now matches task title, description, **and** comment body
- [x] Existing `GlobalSearch.tsx` + `/workspaces/{workspace_id}/search` endpoint unchanged

### F-02: Saved Views
- [x] `backend/app/models/saved_view.py` — `SavedView` model: `user_id`, `list_id | project_id`, `name`, `filters_json (JSONB)`
- [x] `backend/alembic/versions/0022_add_saved_views.py` — creates `saved_views` table with FK indexes
- [x] `backend/app/features/saved_views/` — repository (CRUD), schemas, router registered in `main.py`
- [x] Endpoints: `GET/POST /lists/{id}/saved-views`, `GET/POST /projects/{id}/saved-views`, `DELETE /saved-views/{id}`
- [x] `frontend/src/api/savedViews.ts` — `SavedView`, `SavedViewFilters` types + full CRUD helpers
- [x] `ListPage` — "📋 Views" panel: list/apply/delete saved views; inline save-as-name input
- [x] `ProjectTasksPage` — same Views panel; saves `filter_rules` + `group_by`
- [x] `filters_json` stores `{ filter_rules, cf_filters, group_by }` — full state snapshot

### F-03: Group-by (status / assignee / priority)
- [x] `groupByStatus: boolean` → `groupBy: 'none' | 'status' | 'assignee' | 'priority'` in both pages
- [x] Toolbar button → styled `<select>` with 4 options; turns violet when active
- [x] Status mode: unchanged behavior (ordered by list status definition, "No Status" at end)
- [x] Assignee mode: one group per assignee (tasks appear in each of their assignees' groups) + "Unassigned"
- [x] Priority mode: fixed order Urgent → High → Medium → Low → No Priority, dot colors from `PRIORITY_DOT_COLORS`
- [x] All modes use shared `DisplayGroup` type `{ groupKey, groupLabel, groupColor, tasks, showHeader }`
