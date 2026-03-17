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
| **Phase 14** | 🔲 Not started | TM-02 | Timeline / Gantt view |
| **Phase 15** | ✅ Done | AU-04 | Git webhook: GitHub PR / GitLab MR open → link task, merge → close task |

### Deferred

| Story | Blocked by | Description |
|-------|-----------|-------------|
| TM-02 | Complex UI | Timeline / Gantt view — large frontend build, no backend blocker but deprioritised |
| TM-02 | Complex UI | Timeline / Gantt view — large frontend build, no backend blocker but deprioritised |

## Currently Working On
- Phase 14: Timeline / Gantt view (TM-02) — not started

## Notes
- Every mutating backend endpoint must call `await session.commit()` — see `docs/BACKEND.md`
- Completed tasks are logged in `docs/PROGRESS-COMPLETED.md`
- Story reference: `docs/stories/` — TM, AU, N stories added 2026-03-13
