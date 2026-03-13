# IssueHub - Project Progress

## Phase Status

| Phase | Status | Stories | Description |
|-------|--------|---------|-------------|
| **Phase 0** | ✅ Done | — | Planning, architecture, documentation, user stories |
| **Phase 1** | ✅ Done | T-01, S-01~S-05 | Task CRUD, list status config, Board + List views |
| **Phase 2** | ✅ Done | T-02~T-05, A-01~A-03, A-05 | Subtasks, dependencies, promote, audit trail, comments |
| **Phase 3** | ✅ Done | C-01~C-03, S-04, S-06 | Custom fields, status mapping, list templates |
| **Phase 4** | ✅ Done | A-02 (real-time) | WebSocket real-time, @mention notifications |
| **Phase 5** | ✅ Done | M-05, M-06, M-08 | Multi-assignee, reviewer, My Tasks page |
| **Phase 6** | ✅ Done | C-04, C-05, A-04 | Custom field filtering, role-based field visibility, task links |
| **Phase 7** | ⏳ Not Started | M-01, M-03, M-04 | Teams, team roles, list visibility by team |
| **Phase 8** | ⏳ Not Started | M-07 | Workload view, full-text search, bulk ops, export, analytics |
| **Later** | ⏳ Deferred | M-02 | Email invite flow — needs SMTP infra, do when deploying for real users |

## Currently Working On
- Nothing — Phase 6 complete, ready for Phase 7

## Notes
- Every mutating backend endpoint must call `await session.commit()` — see `docs/BACKEND.md`
- Completed tasks are logged in `docs/PROGRESS-COMPLETED.md`
