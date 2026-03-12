# IssueHub - Project Progress

## Current Phase: Phase 1 (MVP)

## Phase Status

| Phase | Status | Description |
|-------|--------|-------------|
| **Phase 0** | ✅ Done | Planning, architecture, documentation, user stories |
| **Phase 1** | 🔄 In Progress | Task CRUD, list status config, Board + List views |
| **Phase 2** | ⏳ Not Started | Subtasks, dependencies, promote, full audit trail |
| **Phase 3** | ⏳ Not Started | Custom fields, status mapping, list templates |
| **Phase 4** | ⏳ Not Started | WebSocket real-time, file attachments, notifications |
| **Phase 5** | ⏳ Not Started | Full-text search, bulk ops, export, analytics |

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

## Currently Working On
- Phase 1 complete — ready for Phase 2 (subtasks, dependencies, audit trail)

## Completed Tasks
All completed tasks are logged in `docs/PROGRESS-COMPLETED.md`.

## Notes
<!-- Add progress notes, blockers, or decisions here -->
