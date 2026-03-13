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
- [x] C-04 + ListPage: Status and Priority filter dropdowns added to filter bar (always visible, server-side filtering)
- [x] Validation: only one `is_complete` status allowed per list — `PATCH /lists/{id}/statuses/{sid}` returns 422 if another Done status already exists
- [x] Test: `test_only_one_done_status_per_list` covering conflict rejection and unset-then-remark flow

## Phase 7 — Teams, Team Roles, List Visibility (M-01, M-03, M-04)
_Completed: 2026-03-13_

### Backend
- [x] M-01/M-03: `Team` + `TeamMember` models with `SoftDeleteMixin` + `TimestampMixin` — `app/models/team.py`
- [x] `TeamRole` enum: `team_admin`, `team_member`
- [x] Migration 0011: creates `teams`, `team_members` tables and adds `team_ids UUID[]` to `lists`
- [x] `app/features/teams/` module: `schemas.py`, `repository.py`, `service.py`, `router.py`
- [x] Endpoints: POST/GET teams, DELETE team, POST/GET/DELETE team members — all under `/workspaces/{workspace_id}/teams`
- [x] M-04: `PATCH /lists/{list_id}/visibility` — sets `team_ids` on a list (owner/admin only)
- [x] M-04: `list_for_project` filters out restricted lists for non-admin members; workspace owner/admin bypass
- [x] `TeamRepository.get_user_team_ids` used for visibility filtering
- [x] Tests: `backend/tests/test_teams.py` — 9 tests covering CRUD, membership, and all 3 visibility scenarios

### Frontend
- [x] `frontend/src/api/teams.ts` — `teamsApi`, `useTeams`, `useTeamMembers`, `useCreateTeam`, `useDeleteTeam`, `useAddTeamMember`, `useRemoveTeamMember`
- [x] `frontend/src/api/lists.ts` — added `team_ids: string[]` to `List` type; added `setVisibility` method
- [x] `WorkspaceSettingsPage.tsx` — refactored into Templates + Teams tabs; Teams tab shows team list, create team, per-team member management (add/remove, role select)
- [x] `ListSettingsPage.tsx` — added Visibility tab; multi-select checkboxes for teams, calls `PATCH /lists/{id}/visibility`
- [x] `ProjectPage.tsx` — updated header link label from "⚙ Templates" to "⚙ Settings"

---

## Phase 7 — Teams, Team Roles, List Visibility (M-01, M-03, M-04)
_Completed: 2026-03-13_

### Backend
- [x] `Team` + `TeamMember` models with `SoftDeleteMixin` — `team_members.role` ENUM(`team_admin`, `team_member`)
- [x] Migration 0011: `teams`, `team_members` tables + `team_ids UUID[]` column on `lists`
- [x] Teams feature module: `POST/GET /workspaces/{id}/teams`, `DELETE .../teams/{id}`, `POST/GET/DELETE .../teams/{id}/members`
- [x] `PATCH /lists/{id}/visibility` — set `team_ids` (owner/admin only)
- [x] `list_for_project` filters restricted lists for non-admin members; workspace owner/admin bypass
- [x] 10 tests in `test_teams.py` — all passing (119 total, all green)

### Frontend
- [x] `api/teams.ts` — full API layer + hooks (`useTeams`, `useTeamMembers`, `useCreateTeam`, `useDeleteTeam`, `useAddTeamMember`, `useRemoveTeamMember`)
- [x] `api/lists.ts` — `team_ids: string[]` on `List` type + `setVisibility` API call
- [x] `WorkspaceSettingsPage.tsx` — Teams tab: list/create/delete teams, per-team member management
- [x] `ListSettingsPage.tsx` — Visibility tab: multi-select checkboxes for team access restriction
- [x] Workspace settings nav link added to WorkspacePage header

---

## Post-Phase-7 Ad-hoc Improvements
_Completed: 2026-03-13_

### Auth & Security
- [x] Dev login endpoint (`POST /dev/token?email=&display_name=`) — creates/fetches user + JWT; gated by `settings.allow_dev_login` (env `ALLOW_DEV_LOGIN`, default `true`)
- [x] Frontend `LoginPage.tsx` — "Dev login" toggle shows email + display_name form; reads `VITE_ALLOW_DEV_LOGIN` flag
- [x] `qc.clear()` on logout in `HeaderActions.tsx` — wipes TanStack Query cache so next user sees fresh data

### Workspace Member Management
- [x] `GET /auth/users/search?email=` — find user by exact email (any authenticated user)
- [x] Workspace `invite_member` restricted to `owner` role only (admins no longer allowed to invite)
- [x] `WorkspaceSettingsPage.tsx` — Members tab (default): search by email → preview → pick role → Add; shows current members with role selector + remove button
- [x] `api/workspaces.ts` — added `inviteMember`, `updateMemberRole`, `removeMember`, `searchUser`; added `useInviteMember`, `useUpdateMemberRole`, `useRemoveMember` hooks

### Validation
- [x] One Done status per list: `PATCH /lists/{id}/statuses/{sid}` returns 422 if another `is_complete` status already exists
- [x] `test_only_one_done_status_per_list` covers conflict rejection and unset-then-remark flow

### UI / UX
- [x] `TaskDetailPage.tsx` full redesign — 2-column layout: left (borderless title, description textarea with border, tabbed card Subtasks/Dependencies/Links/Fields, Comments, History); right sidebar `w-64` (Status pills, Priority pills with color dots, Assignees, Reviewer)
- [x] `ListPage.tsx` filter bar redesign — pill-shaped `FilterSelect` component (`appearance-none` + custom chevron), active violet highlight, ✕ Clear button
- [x] `docs/FRONTEND.md` updated — TaskDetailPage layout, ListPage filter bar, WorkspaceMember management, Dev login sections; corrected TaskLinks + ActivityTimeline descriptions

---

## Phase 8 — Workload View, Full-Text Search, Bulk Ops, Export, Analytics
_Completed: 2026-03-13_

### Backend
- [x] **Export CSV**: `GET /lists/{id}/tasks/export` — streams CSV with id/title/status/priority/assignees/created_at columns; resolves status names and assignee display names inline; no new migration
- [x] **Full-text search**: `TaskRepository.search()` — ILIKE on title + description; `GET /workspaces/{id}/search?q=` returns `list[TaskResponse]`; empty/short query returns `[]`; workspace-member gated
- [x] **Bulk update**: `POST /tasks/bulk-update` — `BulkUpdateRequest` (task_ids + optional status_id/priority, at least one required); `TaskRepository.bulk_update()` uses `update().where(Task.id.in_(ids))`
- [x] **Bulk delete**: `POST /tasks/bulk-delete` — `TaskRepository.bulk_soft_delete()` sets `deleted_at` for all matched IDs
- [x] **Analytics**: `GET /workspaces/{id}/analytics` — total task count, overdue count (due_date < now Asia/Taipei), tasks grouped by status with resolved names; returns `AnalyticsResponse`
- [x] **Workload view**: `GET /workspaces/{id}/workload` — per-member open task list; returns `list[MemberWorkloadResponse]` with `user_id`, `display_name`, `open_task_count`, `tasks`
- [x] 19 tests across `test_export.py`, `test_search.py`, `test_bulk.py`, `test_analytics.py`, `test_workload.py` — all passing

### Frontend
- [x] `api/tasks.ts` — added `exportCsv(listId)` (blob download), `search(workspaceId, q)`, `bulkUpdate(taskIds, data)`, `bulkDelete(taskIds)`
- [x] `api/workspaces.ts` — added `getAnalytics`, `getWorkload`; `useAnalytics`, `useWorkload` hooks; `AnalyticsResponse`, `MemberWorkloadResponse` types
- [x] `components/GlobalSearch.tsx` — debounced search input (300ms), dropdown overlay with results, Escape/click-outside to close, navigates to `/tasks/:id`
- [x] `views/workspace/AnalyticsPage.tsx` — stat cards (total, overdue, status count), CSS bar chart for tasks-by-status breakdown
- [x] `views/workspace/WorkloadPage.tsx` — per-member cards with avatar, task count badge, collapsible task list
- [x] `views/list/ListPage.tsx` — checkbox column, `selectedIds` state, sticky bulk action bar (status/priority selects + Delete), "⬇ Export CSV" button
- [x] `views/project/ProjectPage.tsx` — added "Analytics" + "Workload" nav links; embedded `<GlobalSearch>`
- [x] Router — added `/workspaces/:id/analytics` and `/workspaces/:id/workload` routes

---

## UI Polish — Workspace, Project, List pages
_Completed: 2026-03-13_

- [x] `WorkspaceHeader` — shared header component used by all workspace pages (Projects/My Tasks/Workload/Analytics nav tabs, GlobalSearch, settings icon); header height h-14 → h-16, nav text-xs → text-sm, workspace name text-sm → text-base
- [x] `WorkspacePage` — greeting h1 text-2xl → text-3xl, workspace card avatars w-12 → w-14, card name text-sm → text-base font-bold; polished empty state with CTA
- [x] `ProjectPage` — page title text-xl → text-2xl, project name text-sm → text-base font-bold, list names text-sm → text-base; now uses shared `WorkspaceHeader`
- [x] `ListPage` — page title text-xl → text-2xl + task count subtitle; table rows py-3 → py-4; task title text-base font-semibold; priority dot w-2 → w-2.5; filter pills h-8/text-xs → h-9/text-sm; empty state with CTA
- [x] `HeaderActions` — user avatar w-6 → w-7, sign-out icon 16px → 18px; shown on every page
- [x] `MyTasksPage`, `WorkloadPage`, `AnalyticsPage` — all use `WorkspaceHeader`; added page title + subtitle, skeleton loaders, polished empty states
- [x] Fix: missing `Link` import in `ProjectPage` after header refactor (caused blank page)
- [x] Fix: `react-hot-toast` import in `ListPage` replaced with project's `@/store/toastStore`


## User Story Gap Fixes (2026-03-13)
- **Due date UI** — added date picker to TaskDetailPage right sidebar; reads `task.due_date`, saves via existing `PATCH /tasks/{id}` (already had `due_date` support)
- **Move task to list (S-04)** — new `PATCH /tasks/{id}/move` backend endpoint; clears `status_id`, updates `list_id`/`project_id`/`workspace_id`, writes `moved` audit entry; new `GET /workspaces/{id}/lists` endpoint; "Move to List" dropdown in TaskDetailPage sidebar shows all other lists in workspace

## UI Polish — Post-Phase 8 (2026-03-13)
- **Due date column in ListPage** — shows due date per task row with overdue (red ⚠), due today (amber "Today"), completed (plain grey), no date (—)
- **Move task to list (S-04)** — `PATCH /tasks/{id}/move` backend endpoint; clears status_id, updates list/project/workspace; `GET /workspaces/{id}/lists` endpoint; "Move to List" dropdown in TaskDetailPage sidebar
- **Due date picker in TaskDetailPage** — date input in right sidebar reads/writes task.due_date
- **English locale for all dates** — all `toLocaleDateString`/`toLocaleString` calls now use `'en-US'`
- **Delete button beautification** — new `DeleteButton` component (icon / text / button variants) with confirm modal dialog (warning icon, context-specific message, Cancel + Delete); replaces all bare text deletes and window.confirm() across ListPage, TaskDetailPage, ListSettingsPage, WorkspaceSettingsPage

## Phase 10 — Time Management Basics (2026-03-13)
- **TM-01 start_date** — migration 0013 adds `start_date` column to tasks; model, schemas (CreateTaskDTO, UpdateTaskDTO, CreateTaskRequest, UpdateTaskRequest, TaskResponse), repository create/update all updated
- **TM-04 story_points** — migration 0013 adds `story_points` column to tasks; same schema/repo plumbing as start_date
- **TM-03 time tracking** — migration 0014 creates `time_entries` table; `TimeEntry` model; full CRUD feature (`repository.py`, `schemas.py`, `router.py`); endpoints: `POST /tasks/{id}/time-entries`, `GET /tasks/{id}/time-entries`, `DELETE /tasks/{id}/time-entries/{entry_id}`; ownership check (403 for other users' entries)
- 11 backend tests all passing (`tests/test_time_entries.py`)

## Phase 9 — Notifications & Watchers (2026-03-13)
- **N-01 Task Watchers** — `TaskWatcher` model + migration; `POST/DELETE/GET /tasks/{id}/watch`; Watch/Unwatch button in TaskDetailPage sidebar
- **N-01 Watcher notifications** — watchers receive `task_updated` notification on task updates and new comments (actor excluded from own notifications)
- **N-03 Assignee notifications** — `assigned` notification sent to newly added assignees
- **N-03 @mention** — confirmed already working via comment creation service
- **N-02** — `immediate/digest` preference deferred (requires SMTP infrastructure)
- 8 backend tests all passing
- **Phase 10 frontend** — TaskDetailPage sidebar: Start Date picker, Story Points input; new Time tab with log form (minutes + optional note), entry list with formatted duration (e.g. "1h 30m"), per-entry delete; `timeEntries.ts` API (`useTimeEntries`, `useLogTime`, `useDeleteTimeEntry`); `start_date`/`story_points` added to Task type

## Post-Phase 10 Polish (2026-03-13)
- **Workload story points** — workload API returns `total_story_points` per member; badge shows "X tasks · Y SP"; load color thresholds based on SP (≥20 red, ≥10 amber); per-task SP shown inline
- **Analytics story points** — repository sums SP per status group and as workspace total; new Story Points stat card (violet); per-status SP shown in Tasks by Status bar chart; stat grid changed to 2×2
- **Date input English locale** — added `lang="en"` to all `<input type="date">` elements (works in Firefox/Safari; Chrome requires browser language setting)

## Phase 11 — Simple Automation (2026-03-13)
- **AU-03 auto-close parent** — `maybe_close_parent()` in tasks router; after any subtask status update checks if all siblings have `is_complete=True`; finds first complete status in parent's list and applies it; writes `auto_closed` audit log; skips if parent already closed or list has no complete status; 5 tests passing

## Post-Phase 11 Polish (2026-03-13)
- **Subtask depth enforcement** — `create_subtask` service raises HTTP 400 if `parent.depth > 0`; test updated to assert 400
- **Subtasks in list page** — `include_subtasks=true` param on list endpoint; ListPage groups parent tasks + their subtasks interleaved, orphaned subtasks appended at end; subtask rows indented (`pl-10`) with `↳ Parent title` clickable breadcrumb
- **Board UI/UX redesign** — full rewrite of `BoardPage.tsx`: color accent bars, priority badge + SP badge + due date badge on cards, assignee avatar stack, subtask count; column header with color bar, SP total, colored count badge; drag-drop drop zone highlight; inline "Add task" form per column; "No Status" column; columns centered with `flex justify-center` + `min-w-max`
- **Rich text editor** — Tiptap editor (`RichTextEditor.tsx`) with full toolbar (Bold, Italic, Underline, Strike, Code, H1/H2/H3, Bullet/Ordered/Task lists, Blockquote, Code block, HR, Undo/Redo); saves on `onBlur` (not per-keystroke); description history shows "edited" instead of raw HTML diff
- **Task list pagination** — `list_for_list` runs count query, returns `(tasks, total)` tuple; router accepts `page`/`page_size` query params (default 0 = all, keeps BoardPage unaffected); sets `X-Total-Count` response header; CORS exposes that header; `tasksApi.listPaged()` reads header; ListPage uses page_size=50, prev/next + numbered page buttons, filter changes reset to page 1
