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

| **Phase 18** | 🔜 Planned | R-01, R-02, R-03 | Reporting — custom dashboard widgets, burndown chart, CSV export |

### Deferred

| Story | Blocked by | Description |
|-------|-----------|-------------|
| TM-02 | Complex UI | Timeline / Gantt view — large frontend build, no backend blocker but deprioritised |
| TM-02 | Complex UI | Timeline / Gantt view — large frontend build, no backend blocker but deprioritised |

## Currently Working On
- Phase 17: E-01 ~ E-05 — Epics (feature grouping for PMs)
  - ✅ E-01: Backend Epic CRUD (model, migration, router, service, repo, tests)
  - ✅ E-02 backend: Task.epic_id FK, UpdateTaskDTO sentinel, bulk_update epic_id
  - ✅ E-05: EpicsPage overview (card grid, color bar, progress, inline rename/status/delete)
  - ✅ E-02 frontend: Epic field in TaskDetailPage sidebar, Epic column in ProjectTasksPage + ListPage, bulk "Set epic…"
  - ✅ E-03: EpicDetailPage — inline name/desc/color/status/dates edit, progress bar, task list with remove, add-tasks search panel
  - ✅ E-04: EpicTimelinePage — Gantt scoped to epic tasks + epic span row, epic accent color for bars, Overview/Timeline tabs
  - Phase 17 complete ✅

## Recently Completed (outside phases)
- Group by status toggle for List view and Project view (frontend-only, no backend changes)
- Global search improvements: search by task key (PROJ-42), show project › list in results, visible on all pages, searches comments
- pg_trgm GIN indexes on tasks.title, tasks.task_key, comments.body for fast ILIKE search at scale
- Design quality pass: normalize (emoji → SVG, priority token dedup), arrange (redundant headings, spacing rhythm), colorize (priority text, overdue badge)
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
