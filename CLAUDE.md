# IssueHub - CLAUDE.md

> **IMPORTANT**: Always read `PROGRESS.md` at the start of every session before doing any work.
> **IMPORTANT**: Always update `PROGRESS.md` to reflect what task you are currently working on.
> **IMPORTANT**: Always append completed tasks to `docs/PROGRESS-COMPLETED.md` after finishing any task.
> **IMPORTANT**: Auto-commit after meaningful changes. Always inform the user what was committed.
> **IMPORTANT**: Every new backend feature must include tests in `backend/tests/test_{feature}.py`. See `docs/BACKEND.md` → Testing section for rules and fixtures.

## Project Overview
Issue tracking system — React.js frontend, FastAPI (Python) backend. Inspired by ClickUp / Jira / Linear.

```
issueHub/
  backend/        # FastAPI
  frontend/       # React + Vite
  docs/           # Architecture docs (read on demand)
  docs/stories/   # User story specs (read on demand)
  docker-compose.yml
  PROGRESS.md
```

## Conventions

### Timezone
- Date/month/year boundaries → **Asia/Taipei (UTC+8)**
- Backend: `now('Asia/Taipei')`. Frontend: `getFullYear()` / `getMonth()` / `getDate()` — never `toISOString().slice()` or locale hacks
- Storage remains UTC; Asia/Taipei only for boundary logic

## Extracted Docs (read on demand)

| File | When to read |
|------|--------------|
| `docs/BACKEND.md` | Any backend/ work |
| `docs/FRONTEND.md` | Any frontend/ work |
| `docs/AUTH.md` | Auth or permission changes |
| `docs/RBAC.md` | Roles, permissions, scoped access |
| `docs/DATA_MODEL.md` | DB schema, entities, indexes |
| `docs/REALTIME.md` | WebSocket, Redis Pub/Sub |
| `docs/DEPLOYMENT.md` | Docker, env vars, prod setup |
| `docs/VERIFICATION.md` | Pre-launch checklist, visual walkthrough, SQL spot checks |
| `docs/PROJECT_STRUCTURE.md` | Canonical folder tree for backend + frontend |
| `docs/EMAIL.md` | Email provider (Resend), transactional email helpers, templates, BackgroundTasks integration |
| `docs/BACKGROUND_JOBS.md` | APScheduler setup, overdue task job (AU-02), notification digest job (N-02) |

## User Story Reference (read on demand)

| File | Coverage |
|------|----------|
| `docs/stories/TASKS.md` | T-01 ~ T-05: Task CRUD, subtasks, blockers, promotion |
| `docs/stories/AUDIT.md` | A-01 ~ A-05: Audit trail, comments, @mention |
| `docs/stories/CUSTOM_FIELDS.md` | C-01 ~ C-05: Custom fields, required, role visibility |
| `docs/stories/STATUS.md` | S-01 ~ S-06: Per-list statuses, kanban, cross-list mapping |
| `docs/stories/ORG_TEAM.md` | M-01 ~ M-04: Org, Team hierarchy, Space/List visibility |
| `docs/stories/ASSIGNEE.md` | M-05 ~ M-08: Multi-assignee, My Tasks, workload, reviewer |
| `docs/stories/TIME_MANAGEMENT.md` | TM-01 ~ TM-04: Due/start date, Gantt, time tracking, story points |
| `docs/stories/AUTOMATION.md` | AU-01 ~ AU-04: Trigger-action rules, overdue notify, auto-close subtasks, Git integration |
| `docs/stories/NOTIFICATIONS.md` | N-01 ~ N-03: Task watchers, notification frequency, @mention |
