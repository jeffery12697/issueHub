# IssueHub - Completed Tasks

A log of all planning and setup tasks completed before active development began.

---

## UI Visual Overhaul (slate/violet design system)
_Completed: 2026-03-12_

- [x] `frontend/src/views/auth/LoginPage.tsx` — gradient bg, violet logo square, tagline, refined Google button
- [x] `frontend/src/views/workspace/WorkspacePage.tsx` — violet header logo, avatar initials, grid workspace cards with colored initials
- [x] `frontend/src/views/project/ProjectPage.tsx` — breadcrumb header, violet dot on project names, list rows with hover pill buttons (List/Board)
- [x] `frontend/src/views/list/ListPage.tsx` — pill toggle (List/Board), priority dot colors, slate table with shadow-sm
- [x] `frontend/src/views/board/BoardPage.tsx` — pill toggle (Board/List), violet drag-over ring, priority dot indicators on cards
- [x] `frontend/src/views/task/TaskDetailPage.tsx` — two-column layout (left: title/desc/subtasks/deps, right: status/priority/history/comments)

---

## Phase 2: Comments (A-02)
_Completed: 2026-03-12_

- [x] `backend/app/models/comment.py` — Comment model (task_id, author_id, body, parent_comment_id, mentions UUID[])
- [x] `backend/alembic/versions/0004_add_comments.py` — migration
- [x] `backend/app/features/comments/` — full feature module (schemas, repository, service, router)
- [x] `WorkspaceRepository.list_member_users()` — added for @mention resolution
- [x] `backend/tests/test_comments.py` — 10 tests, all passing (67 total)
- [x] `frontend/src/api/comments.ts` — API + useComments, useCreateComment, useDeleteComment hooks
- [x] `frontend/src/views/task/TaskDetailPage.tsx` — comments section with post form, delete, @mention hint

---

## Phase 1: Frontend Scaffold
_Completed: 2026-03-12_

- [x] `frontend/package.json` — Vite, React, TypeScript, TanStack Query v5, Zustand, React Router v6, Axios, Tailwind CSS
- [x] `frontend/vite.config.ts` — path alias @/*, proxy /api → localhost:8000
- [x] `frontend/src/api/client.ts` — Axios instance with JWT Bearer interceptor + 401 auto-refresh
- [x] `frontend/src/api/` — auth, workspaces, projects, lists (+ statuses), tasks
- [x] `frontend/src/store/authStore.ts` — Zustand: user, accessToken, setUser, setAccessToken, logout
- [x] `frontend/src/store/uiStore.ts` — Zustand: sidebarOpen, activeTaskId
- [x] `frontend/src/router/index.tsx` — RequireAuth wrapper, all routes (login, callback, workspace, project, list, board, task)
- [x] `frontend/src/views/auth/LoginPage.tsx` — Google OAuth redirect button
- [x] `frontend/src/views/auth/AuthCallbackPage.tsx` — token extraction from URL, redirect to /
- [x] `frontend/src/views/workspace/WorkspacePage.tsx` — list + create workspaces
- [x] `frontend/src/views/project/ProjectPage.tsx` — list + create projects; create lists per project
- [x] `frontend/src/views/list/ListPage.tsx` — table view: create/delete tasks, status + priority columns
- [x] `frontend/src/views/board/BoardPage.tsx` — kanban columns by status, native HTML5 drag-drop
- [x] `frontend/src/views/task/TaskDetailPage.tsx` — inline title edit, status/priority picker, description, delete

---

## Phase 1: Backend Scaffold
_Completed: 2026-03-12_

- [x] `docker-compose.yml` — PostgreSQL 16, Redis 7, FastAPI, Vite services
- [x] `backend/Dockerfile`
- [x] `backend/requirements.txt`
- [x] `backend/.env.example`
- [x] `backend/app/core/` — config, database (async SQLAlchemy), redis, security (JWT)
- [x] `backend/app/models/` — base (SoftDeleteMixin, TimestampMixin), User, Workspace, WorkspaceMember, Project, List, ListStatus, Task (ltree path)
- [x] `backend/alembic/` — env.py + initial migration (0001): all tables, ltree extension, GiST index on path
- [x] `backend/app/features/auth/` — Google OAuth router, service (upsert user), schemas
- [x] `backend/app/features/workspaces/` — full CRUD + member management (invite, role update, remove)
- [x] `backend/app/features/projects/` — full CRUD scoped to workspace
- [x] `backend/app/features/lists/` — full CRUD + status management (create, update, reorder, soft delete)
- [x] `backend/app/features/tasks/` — full CRUD with ltree path, fractional order_index, filters

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

---

## Phase 3 Backend — Custom Fields + List Templates
_Completed: 2026-03-12_

### Custom Fields (C-01, C-02, C-03)
- [x] `backend/app/models/custom_field.py` — CustomFieldDefinition (SoftDelete) + CustomFieldValue (UniqueConstraint)
- [x] `backend/alembic/versions/0005_add_custom_fields.py` — migration for both tables
- [x] `backend/app/features/custom_fields/schemas.py` — FieldType enum, DTOs, request/response Pydantic models
- [x] `backend/app/features/custom_fields/repository.py` — CRUD + PostgreSQL ON CONFLICT upsert
- [x] `backend/app/features/custom_fields/service.py` — auth checks, required field validation (422)
- [x] `backend/app/features/custom_fields/router.py` — 6 endpoints
- [x] `backend/tests/test_custom_fields.py` — 11 tests (all passing)

### List Templates (S-06)
- [x] `backend/app/models/list_template.py` — ListTemplate with JSONB default_statuses
- [x] `backend/alembic/versions/0006_add_list_templates.py` — migration
- [x] `backend/app/features/list_templates/schemas.py` — DTOs, request/response models
- [x] `backend/app/features/list_templates/repository.py` — CRUD
- [x] `backend/app/features/list_templates/service.py` — template management + create-list-from-template
- [x] `backend/app/features/list_templates/router.py` — 4 endpoints
- [x] `backend/tests/test_list_templates.py` — 5 tests (all passing)

### Infrastructure
- [x] `backend/app/main.py` — registered both new routers
- [x] `backend/tests/conftest.py` — added model imports + truncate order entries
- Full test suite: 83 tests, all passing
