# Epics — User Stories (E-01 ~ E-05)

> Epic is a feature-level grouping concept that sits alongside List within a Project.
> Hierarchy: **Workspace → Project → [List | Epic] → Task**
> A Task belongs to a List (functional ownership) and optionally belongs to an Epic (feature ownership).

---

## E-01 · Epic CRUD

**As a** PM or project admin,
**I want to** create, rename, and delete Epics within a Project,
**So that** I can group tasks by feature or milestone.

### Acceptance Criteria
- Epic has: `name` (required), `description` (optional), `color` (hex, for timeline display), `start_date` (optional), `due_date` (optional), `status` (not_started / in_progress / done — simple enum, not list-statuses)
- Epic belongs to a Project (not a List)
- Any workspace member with at least `member` role can create/edit Epics in projects they have access to
- Deleting an Epic nullifies `epic_id` on all its tasks (tasks remain, just unlinked)
- Epic list is accessible from the Project sidebar/header

---

## E-02 · Assign Tasks to Epics

**As a** team member,
**I want to** assign or remove an Epic from a task,
**So that** I can associate my work with the right feature.

### Acceptance Criteria
- Task has a nullable `epic_id` FK → Epic
- Epic can be set from the task detail panel (Epic field in the sidebar)
- Epic can be set inline from the task table (List view, Project view) — same overlay pattern as status/priority
- Changing epic fires an audit log entry (`epic_changed`, old/new epic ID + name)
- Bulk assign: select multiple tasks → set Epic (reuse bulk-update mechanism)

---

## E-03 · Epic Detail View

**As a** PM,
**I want to** open an Epic and see all its tasks,
**So that** I can track feature progress across all Lists.

### Acceptance Criteria
- Route: `/projects/:projectId/epics/:epicId`
- Shows Epic name, description, dates, status, progress bar (% tasks in a `done`-category status)
- Task list grouped by List (functional team), showing task key, title, status, assignees, due date
- Inline status/priority editing works same as Project task view
- Tasks can be removed from the epic from this view

---

## E-04 · Epic Timeline (Gantt scoped to Epic)

**As a** PM,
**I want to** see a Gantt-style timeline scoped to an Epic,
**So that** I can visualize feature delivery across teams.

### Acceptance Criteria
- Accessible from Epic Detail View ("Timeline" tab)
- X-axis = date range (auto-fit to epic start/due_date, or earliest/latest task dates)
- Rows = tasks belonging to the epic, grouped by List
- Each task rendered as a bar from `start_date` to `due_date` (or single dot if no range)
- Color-coded by task status category (not_started=gray, active=blue, done=green)
- Epic itself rendered as a summary bar spanning all task dates
- Read-only in first pass (no drag-to-reschedule yet)

---

## E-05 · Epic Overview (Project-level)

**As a** PM,
**I want to** see all Epics in a Project at a glance,
**So that** I can track overall feature portfolio health.

### Acceptance Criteria
- Route: `/projects/:projectId/epics` (or tab in Project header)
- Lists all Epics as cards: name, color strip, date range, status badge, progress bar (% done tasks), task count
- Cards are clickable → Epic Detail View
- Epics sortable by: name, start date, due date, status
- "New Epic" button creates an Epic inline or via modal
