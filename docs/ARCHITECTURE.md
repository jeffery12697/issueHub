# System Architecture

## Overview

IssueHub is a full-featured issue tracking system with a React SPA frontend and a FastAPI backend. The architecture is designed for developer-team use: low-latency reads, real-time collaboration, and a clean separation between presentation and data concerns.

```
Browser (React SPA)
      │  REST + WebSocket
      ▼
FastAPI (Python)   ──────────►  PostgreSQL 16
      │                              │
      │  Pub/Sub                     │  ltree, pg_trgm
      ▼                              │
   Redis 7  ◄────────────────────────┘
      │
      ▼
  WebSocket fan-out → connected browser tabs
      │
      ▼
   MinIO (S3)        APScheduler
 (file storage)   (background jobs)
```

---

## Technology Choices & Rationale

### Backend

| Technology | Why |
|------------|-----|
| **FastAPI** | Async-first Python framework — `async/await` throughout means a single process handles many concurrent WebSocket connections without threads. Auto-generates OpenAPI docs (`/docs`) with zero extra work, which makes API exploration trivial during development. |
| **SQLAlchemy 2.0 (async)** | Async ORM matches FastAPI's async model. The 2.0 API (`select()` style) is explicit and composable; much easier to build dynamic query filters than string concatenation. |
| **Alembic** | Versioned, code-reviewable migrations. Every schema change is a Python file in git, so rollback and environment parity are straightforward. |
| **PostgreSQL 16** | Chosen over MySQL or SQLite for three specific features: (1) `ltree` extension for subtask hierarchy traversal, (2) `pg_trgm` GIN indexes for fast `ILIKE` full-text search on task titles and comments without a separate search engine, (3) strong JSONB support for custom field values and widget config. |
| **Redis 7** | Two roles: (1) Pub/Sub message broker for WebSocket fan-out — when any backend instance publishes an event, all instances relay it to their connected sockets, so the system scales horizontally without sticky sessions; (2) potential cache layer (TTL-based). Redis is operationally simple and already required for Pub/Sub, so adding cache is free. |
| **Pydantic v2** | Tight FastAPI integration for request validation and response serialisation. V2 is significantly faster than V1 due to Rust-backed core. |
| **APScheduler** | Lightweight in-process scheduler for two background jobs (daily digest emails, overdue task notifications). No external job queue (Celery, RQ) was warranted at this scale; APScheduler adds no infrastructure. |
| **python-jose + authlib** | `authlib` handles Google OAuth 2.0 flow (PKCE, token exchange); `python-jose` signs/verifies short-lived JWTs. Separating auth flow from token validation keeps each library small and auditable. |

### Frontend

| Technology | Why |
|------------|-----|
| **React 18** | Component model maps naturally to the hierarchical UI (workspace → project → list → task). Concurrent features (Suspense, transitions) are available when needed. Largest ecosystem of compatible libraries (DnD, rich text, etc.). |
| **TypeScript** | The frontend touches ~40 API shapes and ~60 component interfaces. Without types, refactoring becomes a guessing game. TS pays back the upfront cost in catching shape mismatches between API response and component props at compile time. |
| **Vite** | Sub-second HMR during development (esbuild for dev, Rollup for prod). No webpack configuration overhead. |
| **Tailwind CSS** | Utility-first approach keeps styles co-located with markup — no context-switching to a CSS file. The `dark:` variant prefix makes dark mode a first-class concern without maintaining two stylesheets. Purge is automatic, so bundle size stays small. |
| **TanStack Query v5** | Manages all server state (caching, background refetch, optimistic updates, invalidation). Without it, every component would need its own loading/error/stale logic. The `queryKey` hierarchy makes cache invalidation (e.g. invalidate all tasks in a list after a mutation) declarative and reliable. |
| **Zustand** | Minimal global client state: auth session (user + tokens) and UI state (sidebar, modals). Redux would be over-engineered; React Context re-renders too broadly. Zustand is ~1 KB and has no boilerplate. |
| **React Router v6** | Nested route layouts (`/workspaces/:id/projects/:id/lists/:id`) match the data hierarchy. Loader/action model (v6.4+) is available if needed for data prefetching. |
| **Tiptap** | Rich-text editor built on ProseMirror. Chosen over Quill or plain `contenteditable` because: (1) plugin architecture allows adding @mention, table, image, text-color nodes without forking the editor, (2) outputs clean HTML that is safe to store and render, (3) active maintenance. |
| **@dnd-kit** | Accessible, touch-friendly drag-and-drop for Kanban board and dashboard widget reorder. Built for React (unlike Sortable.js); does not mutate the DOM directly. |

### Infrastructure

| Technology | Why |
|------------|-----|
| **Docker Compose** | Single command (`docker compose up --build`) reproduces the full stack — backend, frontend dev server, PostgreSQL, Redis, MinIO — on any machine. Eliminates "works on my machine" during evaluation. |
| **MinIO** | S3-compatible object storage running locally. Using the AWS S3 SDK means a one-line config change swaps MinIO for real S3 in production — no code changes required. |

---

## Component Descriptions

### Backend modules (`backend/app/features/`)

Each feature follows a **router → service → repository** layering:

| Module | Responsibility |
|--------|---------------|
| `auth` | Google OAuth callback, JWT issue/refresh, dev login |
| `workspaces` | Workspace CRUD, member management, search, analytics, workload |
| `projects` | Project CRUD, per-project analytics |
| `lists` | List CRUD, per-list status config, custom fields, automations, visibility |
| `tasks` | Task CRUD, subtasks, move/promote, bulk ops, CSV export |
| `status_mappings` | Cross-list status resolution rules |
| `comments` | Threaded comments with @mention parsing |
| `audit` | Immutable audit log entries (field changes, comments, assignments) |
| `custom_fields` | Field definitions + per-task field values |
| `dependencies` | Blocked-by / blocking task graph |
| `watchers` | Task watch subscriptions |
| `notifications` | In-app notification feed, unread count, mark-read |
| `teams` | Team CRUD, team membership, list visibility scoping |
| `epics` | Epic CRUD, epic–task assignment, progress aggregation |
| `tags` | Workspace tag CRUD, task tag assignment |
| `approvals` | Per-task approval records |
| `time_entries` | Manual time logging per task |
| `automations` | Trigger-action rules evaluated on task mutation |
| `webhooks` | GitHub / GitLab push event ingestion |
| `links` | External URL links attached to tasks |
| `attachments` | File upload / download via MinIO presigned URLs |
| `dashboard` | Widget definitions + aggregated widget data |
| `saved_views` | Per-list saved filter presets |
| `list_templates` | Workspace-level reusable status + field templates |
| `description_templates` | Workspace-level rich-text description templates |
| `websocket` | WebSocket connection management + Redis subscriber loop |

### Frontend pages (`frontend/src/views/`)

| Page | Route |
|------|-------|
| Login | `/login` |
| Workspace list | `/` |
| Workspace dashboard | `/workspaces/:id` |
| List (table view) | `/lists/:id` |
| Board (kanban) | `/lists/:id/board` |
| Task detail | `/tasks/:id` |
| Project task table | `/projects/:id/tasks` |
| Project Gantt | `/projects/:id/gantt` |
| My Tasks | `/workspaces/:id/my-tasks` |
| Workload | `/workspaces/:id/workload` |
| Analytics | `/workspaces/:id/analytics` |
| Dashboard | `/workspaces/:id/dashboard` |
| Epics overview | `/projects/:id/epics` |
| Epic detail | `/projects/:id/epics/:epicId` |
| Epic timeline | `/projects/:id/epics/:epicId/timeline` |
| Workspace settings | `/workspaces/:id/settings` |
| Project settings | `/projects/:id/settings` |
| List settings | `/lists/:id/settings` |

---

## Data Model Summary

Full schema is in `docs/DATA_MODEL.md`. Key relationships:

```
Workspace
  └── Project
        ├── List
        │     ├── Task ──── Subtasks (self-referential)
        │     │       ├── Comments
        │     │       ├── Custom field values
        │     │       ├── Time entries
        │     │       ├── Attachments
        │     │       ├── Watchers
        │     │       ├── Approvals
        │     │       └── Tags (M:M)
        │     ├── Statuses
        │     ├── Custom field definitions
        │     └── Automations
        └── Epic ──── Tasks (M:M via epic_id on Task)
  └── Teams ──── Lists (visibility)
  └── Members
  └── Tags
  └── Dashboard widgets
  └── Notifications
```

---

## Real-Time Architecture

See `docs/REALTIME.md` for full detail. Summary:

1. A mutation endpoint (e.g. update task) calls `publish_task_event(task_id, ...)` which writes to Redis channel `task:{id}`.
2. A single background `redis_listener()` coroutine (started at app startup) uses `psubscribe("task:*", "list:*", "user:*")` to receive all messages.
3. The listener calls `broadcast_from_redis(channel, message)` which sends the JSON payload to every WebSocket connected on that channel.
4. Frontend hooks (`useTaskSocket`, `useListSocket`, `useUserSocket`) receive the event and call `queryClient.invalidateQueries(...)` — React Query re-fetches only the affected data.

This design keeps the WebSocket layer stateless relative to business logic and decouples publishers from subscribers.
