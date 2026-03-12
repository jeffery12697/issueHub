# IssueHub - Completed Tasks

A log of all planning and setup tasks completed before active development began.

---

## Pre-Development: Planning & Documentation
_Completed: 2026-03-12_

### Architecture Planning
- [x] Defined system architecture (React + FastAPI + PostgreSQL + Redis)
- [x] Designed data model — all core entities, relationships, indexes (see `docs/DATA_MODEL.md`)
- [x] Defined API structure — all endpoint groups and conventions
- [x] Chose PostgreSQL `ltree` for task tree (over recursive CTEs)
- [x] Chose float fractional indexing for drag-drop ordering
- [x] Designed Redis Pub/Sub + WebSocket real-time architecture
- [x] Defined 5 implementation phases

### Documentation
- [x] Created `CLAUDE.md` — project overview, conventions, doc index
- [x] Created `PROGRESS.md` — phase tracker and per-phase checklist
- [x] Created `docs/BACKEND.md` — FastAPI stack, API conventions, DB rules
- [x] Created `docs/FRONTEND.md` — React stack, component structure, UI patterns
- [x] Created `docs/AUTH.md` — JWT flow, roles, password rules
- [x] Created `docs/RBAC.md` — role hierarchy, team scoping, enforcement checklist
- [x] Created `docs/DATA_MODEL.md` — full schema with all tables, columns, indexes
- [x] Created `docs/REALTIME.md` — WebSocket + Redis Pub/Sub design
- [x] Created `docs/DEPLOYMENT.md` — Docker Compose, env vars, prod setup
- [x] Created `docs/PROJECT_STRUCTURE.md` — full folder tree (backend + frontend)

### User Stories
- [x] Defined T-01 ~ T-05: Task CRUD, nested subtasks, blockers, promotion (`docs/stories/TASKS.md`)
- [x] Defined A-01 ~ A-05: Audit trail, comments, @mention, attachments (`docs/stories/AUDIT.md`)
- [x] Defined C-01 ~ C-05: Custom fields, required fields, role visibility (`docs/stories/CUSTOM_FIELDS.md`)
- [x] Defined S-01 ~ S-06: Per-list statuses, kanban, cross-list mapping, templates (`docs/stories/STATUS.md`)
- [x] Defined M-01 ~ M-04: Organization, Team hierarchy, Space/List visibility (`docs/stories/ORG_TEAM.md`)
- [x] Defined M-05 ~ M-08: Multi-assignee, My Tasks, workload view, reviewer role (`docs/stories/ASSIGNEE.md`)
