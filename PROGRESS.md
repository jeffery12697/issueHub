# IssueHub - Project Progress

## Phase Status

### Completed

| Phase | Status | Stories | Description |
|-------|--------|---------|-------------|
| **Phase 0** | ✅ Done | — | Planning, architecture, documentation, user stories |
| **Phase 1** | ✅ Done | T-01, S-01~S-05 | Task CRUD, list status config, Board + List views |
| **Phase 2** | ✅ Done | T-02~T-05, A-01~A-03, A-05 | Subtasks, dependencies, promote, audit trail, comments |
| **Phase 3** | ✅ Done | C-01~C-03, S-04, S-06 | Custom fields, status mapping, list templates |
| **Phase 4** | ✅ Done | A-02 (real-time) | WebSocket real-time, @mention notifications |
| **Phase 5** | ✅ Done | M-05, M-06, M-08 | Multi-assignee, reviewer, My Tasks page |
| **Phase 6** | ✅ Done | C-04, C-05, A-04 | Custom field filtering, role-based field visibility, task links |
| **Phase 7** | ✅ Done | M-01, M-03, M-04 | Teams, team roles, list visibility by team |
| **Phase 8** | ✅ Done | M-07 | Workload view, full-text search, bulk ops, export, analytics |
| **Phase 9** | ✅ Done | N-01, N-03 | Task watchers, watcher notifications, assignee notifications |
| **Phase 10** | ✅ Done | TM-01, TM-03, TM-04 | Start date, time tracking, story points (backend + frontend) |

### Upcoming

| Phase | Status | Stories | Description |
|-------|--------|---------|-------------|
| **Phase 11** | ✅ Done | AU-03 | Auto-close parent task when all subtasks done |
| **Phase 12** | ✅ Done | AU-01 | Advanced automation — trigger-action rules (AU-04 deferred: needs Git webhook infra) |
| **Phase 13** | ✅ Done | M-02, N-02, AU-02 | Email invites, notification digest, overdue task notifications |
| **Phase 14** | ✅ Done | TM-02 | Timeline / Gantt view (project-level) |
| **Phase 15** | ✅ Done | AU-04 | Git webhook: GitHub PR / GitLab MR open → link task, merge → close task |
| **Phase 16** | ✅ Done | F-01, F-02, F-03 | Global search (+ comments), saved views, group-by (status / assignee / priority) |

| **Phase 18** | ✅ Done | R-01, R-03 | Reporting — custom dashboard widgets, CSV export (R-02 deferred) |

### Deferred

| Story | Blocked by | Description |
|-------|-----------|-------------|
| TM-02 | Complex UI | Timeline / Gantt view — large frontend build, no backend blocker but deprioritised |
| R-02 | Deferred | Burndown chart — deferred by user |

## Currently Working On
- (nothing — ready for next task)

## Recently Completed (outside phases, continued)
- Multi-tag support: workspace-level tags (name + color), admin/owner CRUD, any member assign/remove, tag chips in List/Project/Board views, tag filter (AND logic) in all three, Tags tab in Workspace Settings, 14 backend tests (migration 0031, commit f307c2f)

## Recently Completed (outside phases, continued)
- Linked PR/MR details in task git section: task_git_links table (migration 0027), webhook captures pr_title/pr_url, GET /tasks/{id}/git-links, TaskDetailPage shows PR cards with platform icon, title link, status badge (open/merged), count badge on Git header (commit 2737c08)

## Recently Completed (outside phases, continued)
- `/impeccable:adapt` mobile/tablet responsive pass: new ProjectHeader component (two-row mobile layout), all page headers px-4 sm:px-6, all mains responsive py/px, EpicDetailPage/EpicTimelinePage two-row inline mobile headers with breadcrumb truncation, stat grid cols-1 sm:cols-2 fix (commit 7ef48bd)

## Recently Completed (outside phases)
- Group by status toggle for List view and Project view (frontend-only, no backend changes)
- Global search improvements: search by task key (PROJ-42), show project › list in results, visible on all pages, searches comments
- pg_trgm GIN indexes on tasks.title, tasks.task_key, comments.body for fast ILIKE search at scale
- Design quality pass: normalize (emoji → SVG, priority token dedup), arrange (redundant headings, spacing rhythm), colorize (priority text, overdue badge)
- Impeccable audit → normalize → harden: design token compliance, SVG icon system, avatar dedup, ARIA dialog/menu/focus patterns, keyboard drag-and-drop, responsive padding
- Bulk move tasks between lists (list page + project page), restricted to same-project lists
- Status mapping (S-04): cross-list status resolution (explicit rule → name match → null) on move and bulk move
- Status sort order: drag-to-reorder in List Settings and workspace list template editor; order_index persisted and restored on template apply
- Column sorting for List and Project task views: Title, Priority, Due Date (backend sort_by/sort_dir params + clickable column headers)
- Quick search filter + Hide completed toggle on List and Project task views
- Board view capped at 100 tasks (was unbounded); added "Switch to List view" notice when total > 100
- Board view full filter bar: status/priority server-side filters, custom field filters, search, hide completed (matching List page)
- Inline single-click editing for status, priority, and due date in List and Project table views (invisible overlay pattern)
- Project page CSV export button (exports task_key + list column in addition to base fields)

## Notes
- Every mutating backend endpoint must call `await session.commit()` — see `docs/BACKEND.md`
- Completed tasks are logged in `docs/PROGRESS-COMPLETED.md`
- Story reference: `docs/stories/` — TM, AU, N stories added 2026-03-13; F stories added 2026-03-17
