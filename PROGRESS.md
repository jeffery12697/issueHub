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

### Upcoming

| Phase | Status | Stories | Description |
|-------|--------|---------|-------------|
| **Phase 9** | 🔲 Not started | N-01, N-02, N-03 | Notifications — task watchers, immediate/digest preference, @mention delivery |
| **Phase 10** | 🔲 Not started | TM-01, TM-03, TM-04 | Time management basics — start date, time tracking, story points |
| **Phase 11** | 🔲 Not started | AU-02, AU-03 | Simple automation — overdue notifications, auto-close parent on subtasks done |
| **Phase 12** | 🔲 Not started | AU-01, AU-04 | Advanced automation — trigger-action rules, Git commit keyword integration |
| **Phase 13** | 🔲 Not started | TM-02 | Timeline / Gantt view |

### Deferred

| Phase | Status | Stories | Description |
|-------|--------|---------|-------------|
| **—** | ⏳ Deferred | M-02 | Email invite flow — needs SMTP infra, revisit when deploying for real users |

## Currently Working On
- Nothing — Phase 8 complete, new phases planned (9–13)

## Notes
- Every mutating backend endpoint must call `await session.commit()` — see `docs/BACKEND.md`
- Completed tasks are logged in `docs/PROGRESS-COMPLETED.md`
- Story reference: `docs/stories/` — TM, AU, N stories added 2026-03-13
