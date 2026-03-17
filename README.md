# IssueHub

A full-featured project management and issue tracking system inspired by Linear, ClickUp, and Jira. Built with a React frontend and FastAPI backend.

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white)
![Python](https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white)

---

## Features

### Task Management
- Create, edit, and delete tasks across projects and lists
- Subtasks (one level deep) with auto-close parent when all subtasks complete
- Task dependencies (blocked by / blocking) with inline resolution badges
- Promote a subtask to a top-level task
- Move tasks between lists
- Bulk status/priority updates and bulk delete
- File attachments on tasks and comments (MinIO / S3)

### Views
| View | Description |
|------|-------------|
| **List** | Sortable table with filters, pagination, bulk selection, and CSV export |
| **Board** | Kanban drag-and-drop columns by status |
| **My Tasks** | Cross-list view of everything assigned to the current user |
| **Project Tasks** | Cross-list view for all tasks in a project with advanced filters |
| **Workload** | Per-member open task count and story points |
| **Analytics** | Task breakdown by status with story point totals (workspace and project) |

### Statuses & Custom Fields
- Per-list configurable statuses with colors and "done" semantics
- 6 field types: text, number, date, dropdown, checkbox, URL
- Role-based field visibility and editability
- List templates with preset statuses and custom fields

### Time & Planning
- Due dates and start dates with overdue / due-today highlighting
- Story points
- Time tracking — log entries with duration and notes

### Collaboration
- Multi-assignee and reviewer per task
- Real-time updates via WebSocket + Redis Pub/Sub
- In-app notifications: @mentions, assignee changes, task updates, watchers
- Rich text comments and descriptions (Tiptap) — bold, italic, lists, headings, tables, images, text color, font size, highlight, @mention autocomplete
- Task links (external URLs) and full audit trail

### Notifications & Email
- In-app notification feed with unread badge
- Notification preferences: immediate or daily digest
- Daily digest email summarizing unread notifications (8 AM, Asia/Taipei)
- Overdue task email notifications (daily background job)
- Email-based workspace invites

### Automation
- Trigger-action rules scoped to a list
- Triggers: status changed, priority changed
- Actions: set status, set priority, assign reviewer, clear assignees
- Git webhook integration: GitHub PR / GitLab MR open → link task, merge → close task

### Search & Filters
- Global full-text search across tasks, keys, and comments (pg_trgm GIN indexes)
- Search by task key (e.g. `PROJ-00042`)
- Saved views per list
- Group-by: status, assignee, priority

### Organization & Access Control
- Workspaces → Projects → Lists → Tasks hierarchy
- Teams with roles (team admin / team member)
- List visibility restricted by team — enforced on all task endpoints
- Workspace roles: owner, admin, member
- Team-restricted lists: only assigned team members (plus owner/admin) can view

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS (dark mode) |
| State / Data | TanStack Query v5, Zustand, React Router v6 |
| Backend | FastAPI, Python 3.12, SQLAlchemy (async) |
| Database | PostgreSQL 16 (ltree for task trees, pg_trgm for search) |
| Cache / Pub-Sub | Redis 7 |
| Real-time | WebSocket + Redis Pub/Sub |
| Auth | Google OAuth 2.0 + JWT (access + refresh tokens) |
| Rich Text | Tiptap |
| File Storage | MinIO (S3-compatible) |
| Email | SMTP — Mailtrap for dev, any SMTP provider for prod |
| Background Jobs | APScheduler (overdue notifications, digest emails) |

---

## Project Structure

```
issueHub/
├── backend/
│   ├── app/
│   │   ├── core/          # config, database, redis, security
│   │   ├── features/      # one module per domain (tasks, lists, teams, …)
│   │   └── models/        # SQLAlchemy ORM models
│   ├── alembic/           # database migrations
│   └── tests/             # pytest test suite
├── frontend/
│   └── src/
│       ├── api/           # Axios clients + TanStack Query hooks
│       ├── components/    # shared UI components
│       ├── context/       # React context providers (theme, etc.)
│       ├── hooks/         # custom hooks (WebSocket, theme, …)
│       ├── store/         # Zustand stores
│       └── views/         # page components
├── docs/                  # architecture docs and user stories
└── docker-compose.yml
```

---

## Getting Started

### Prerequisites
- Docker and Docker Compose
- A Google OAuth 2.0 app (Client ID + Secret) — or use dev login (no OAuth required)

### 1. Clone and configure

```bash
git clone https://github.com/jeffery12697/issueHub.git
cd issueHub
cp backend/.env.example backend/.env
```

Edit `backend/.env`:

```env
DATABASE_URL=postgresql+asyncpg://issuehub:issuehub@db:5432/issuehub
REDIS_URL=redis://redis:6379/0

JWT_SECRET_KEY=your-long-random-secret

GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:8000/api/v1/auth/google/callback

FRONTEND_URL=http://localhost:5173
ALLOW_DEV_LOGIN=true

# Email — set MAIL_ENABLED=true to send real emails
MAIL_SERVER=sandbox.smtp.mailtrap.io
MAIL_PORT=2525
MAIL_SENDER_NAME=IssueHub
MAIL_SENDER_EMAIL=noreply@issuehub.app
MAIL_USERNAME=your-mailtrap-username
MAIL_PASSWORD=your-mailtrap-password
MAIL_ENABLED=false
```

### 2. Start all services

```bash
docker compose up --build
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:8000 |
| Swagger docs | http://localhost:8000/docs |
| MinIO console | http://localhost:9001 |

### 3. Run database migrations

```bash
docker compose exec backend alembic upgrade head
```

### 4. Log in

**Google OAuth** — click "Sign in with Google" on the login page.

**Dev login** (no OAuth setup needed) — toggle "Dev login" and enter any email and display name.

---

## Running Tests

```bash
docker compose exec backend pytest
```

The test suite uses a separate async test database with automatic table truncation between tests.

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | Async PostgreSQL connection string | — |
| `REDIS_URL` | Redis connection string | — |
| `JWT_SECRET_KEY` | Secret for signing JWTs | — |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Access token lifetime | `15` |
| `REFRESH_TOKEN_EXPIRE_DAYS` | Refresh token lifetime | `7` |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | — |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | — |
| `GOOGLE_REDIRECT_URI` | OAuth callback URL | — |
| `FRONTEND_URL` | Allowed CORS origin | `http://localhost:5173` |
| `ALLOW_DEV_LOGIN` | Enable dev login endpoint | `true` |
| `MAIL_SERVER` | SMTP host | — |
| `MAIL_PORT` | SMTP port | `587` |
| `MAIL_USERNAME` | SMTP username | — |
| `MAIL_PASSWORD` | SMTP password | — |
| `MAIL_SENDER_EMAIL` | From address | — |
| `MAIL_ENABLED` | Actually send emails | `false` |
| `S3_ENDPOINT_URL` | MinIO / S3 endpoint (internal) | `http://minio:9000` |
| `S3_ACCESS_KEY` | S3 access key | `issuehub` |
| `S3_SECRET_KEY` | S3 secret key | — |
| `S3_BUCKET` | Attachments bucket name | `issuehub-attachments` |
| `S3_PUBLIC_URL` | Public presigned URL base | `http://localhost:9000` |

---

## API Overview

All endpoints are prefixed with `/api/v1`. Full interactive docs at `/docs`.

| Resource | Endpoints |
|----------|-----------|
| Auth | `POST /auth/google`, `POST /auth/refresh`, `GET /auth/me` |
| Dev login | `POST /dev/token` |
| Workspaces | `GET/POST /workspaces`, `PATCH/DELETE /workspaces/{id}`, members, analytics, workload, search |
| Projects | `GET/POST /workspaces/{id}/projects`, `PATCH/DELETE /projects/{id}`, analytics |
| Lists | `GET/POST /projects/{id}/lists`, statuses, custom fields, automations, visibility |
| Tasks | `GET/POST /lists/{id}/tasks`, `GET/PATCH/DELETE /tasks/{id}`, subtasks, move, promote, bulk ops, export |
| Task detail | Dependencies, links, comments, attachments, time entries, watchers, audit log |
| Teams | `GET/POST/DELETE /workspaces/{id}/teams`, team members |
| Templates | `GET/POST/PATCH/DELETE /workspaces/{id}/list-templates` |
| Invites | `POST /workspaces/{id}/invites`, `POST /invites/{token}/accept` |
| Notifications | `GET /notifications`, mark read, unread count, preferences |
| Webhooks | `POST /webhooks/github`, `POST /webhooks/gitlab` |
| WebSocket | `ws://localhost:8000/ws/tasks/{id}`, `/ws/lists/{id}` |
