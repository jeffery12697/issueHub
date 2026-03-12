# IssueHub - Project Progress

## Current Phase: Phase 1 (MVP)

## Phase Status

| Phase | Status | Description |
|-------|--------|-------------|
| **Phase 0** | ✅ Done | Planning, architecture, documentation, user stories |
| **Phase 1** | ⏳ Not Started | Task CRUD, list status config, Board + List views |
| **Phase 2** | ⏳ Not Started | Subtasks, dependencies, promote, full audit trail |
| **Phase 3** | ⏳ Not Started | Custom fields, status mapping, list templates |
| **Phase 4** | ⏳ Not Started | WebSocket real-time, file attachments, notifications |
| **Phase 5** | ⏳ Not Started | Full-text search, bulk ops, export, analytics |

## Phase 1 Checklist

### Backend
- [ ] Docker Compose setup (PostgreSQL, Redis, FastAPI)
- [ ] Alembic + initial schema migration
- [ ] Core models: User, Workspace, Project, List, ListStatus, Task (with SoftDeleteMixin)
- [ ] Google OAuth (authlib) + JWT issue/refresh
- [ ] Workspace & Project CRUD
- [ ] List CRUD + status management (create, reorder, mark complete)
- [ ] Task CRUD endpoints

### Frontend
- [ ] Vite + React + TypeScript scaffold
- [ ] Google OAuth login page
- [ ] Workspace / Project navigation
- [ ] Board view (kanban columns by status)
- [ ] List view (table rows)
- [ ] Task detail page (view/edit)

## Currently Working On
_Nothing in progress_

## Completed Tasks
All completed tasks are logged in `docs/PROGRESS-COMPLETED.md`.

## Notes
<!-- Add progress notes, blockers, or decisions here -->
