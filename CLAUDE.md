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
| `docs/WEBHOOK.md` | Git webhook integration (AU-04): GitHub/GitLab push events, commit keyword task-close |

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
| `docs/stories/FILTERS.md` | F-01 ~ F-03: Global search, saved views, group-by |

## Design Context

### Users
Software developers and cross-functional teams (devs, designers, PMs) tracking tasks, bugs, and sprints. Long sessions at a desk; need fast navigation, clear hierarchy, and zero cognitive overhead. The interface competes with terminals and editors — earn every glance.

### Brand Personality
**Focused · Fast · Clean** — a productivity tool that gets out of the way. Sharp and confident, never flashy. Users should feel in control.

### Aesthetic Direction
- Minimal, Linear-inspired: white/`slate-50` surfaces, `violet-600` as the single accent
- `rounded-xl` cards, `rounded-lg` buttons/inputs, `shadow-sm` only (elevation via borders, not shadows)
- **Typography**: system-ui (confirmed — native sans on each OS, no web font dependency)
- **Dark mode: planned as a priority** — avoid hardcoded light-only values; use `dark:` Tailwind variants on new components
- No purple gradients; no card-in-card nesting; no glassmorphism; no bounce/elastic animations
- **Icons**: transitioning to Lucide React (`lucide-react`). New inline SVGs follow Feather style: `fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"`

### Design Principles
1. **Clarity over decoration** — every element must serve information hierarchy; remove anything that doesn't help the user decide
2. **Violet is a signal, not wallpaper** — use `violet-600` only for interactive/active/actionable states; never as background decoration
3. **Density with breathing room** — compact rows and tight spacing at the row level, whitespace at card/section boundaries
4. **Consistent motion** — Tailwind-default 150ms `ease` only; no bounce, no elastic; `prefers-reduced-motion` global override in `index.css`; use skeleton loaders not spinners
5. **Status speaks first** — priority colors (sky/amber/orange/red) and status badges are the highest-priority visual signals on any task surface

### Key Tokens (quick reference)
- **Page bg**: `bg-slate-50` · **Card**: `bg-white border border-slate-200 rounded-xl shadow-sm`
- **Primary btn**: `bg-violet-600 text-white rounded-lg hover:bg-violet-700`
- **Secondary btn**: `border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50`
- **Focus ring**: `focus:outline-none focus:ring-2 focus:ring-violet-500`
- **Active tint**: `bg-violet-50 text-violet-700`
- **Priority colors**: import `PRIORITY_DOT_COLORS` / `PRIORITY_COLORS` from `@/lib/priority` — never redefine locally
- **Avatar colors**: muted `-100` bg + `-700` text (6 hues); never saturated `-500`
- **Table header**: `bg-slate-50 border-b border-slate-200`, cells `text-xs font-semibold text-slate-500 uppercase tracking-wider`

### Delight
Subtle micro-interactions only — the kind noticed unconsciously. Allowed: color transitions, `hover:-translate-y-0.5` lift, focus ring appearance, status badge color changes. Never: confetti, bounce animations, particle effects, celebration copy.
