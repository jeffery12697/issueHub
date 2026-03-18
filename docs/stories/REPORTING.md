# Reporting — User Stories (R-01 ~ R-03)

> Dashboards, burndown charts, and CSV exports for managers and PMs to monitor project health.

---

## R-01 · Custom Dashboard with Widgets

**As a** workspace admin,
**I want to** create a custom Dashboard and place various widgets (completion rate, overdue count, member workload),
**So that** I can get a full picture of project health on a single page.

### Acceptance Criteria
- Dashboard page is accessible from the workspace sidebar
- Admin can add / remove / reorder widgets from a fixed widget catalogue:
  - **Completion rate** — % of tasks in a `done`-category status (workspace-wide or per-project filter)
  - **Overdue count** — number of tasks past their due date and not done
  - **Member workload** — bar chart of open task count per assignee
- Widget layout is persisted per user (user-specific dashboard config)
- Each widget supports a project / date-range filter (e.g., "last 30 days", "this month")
- Dashboard is read-only for non-admin members (they see the saved layout but cannot edit it)

---

## R-02 · Sprint / Milestone Burndown Chart

**As a** PM,
**I want to** see a burndown chart for a sprint or milestone,
**So that** I can track whether the team is on pace to finish the sprint.

### Acceptance Criteria
- Burndown chart is accessible from a List or Epic detail view ("Burndown" tab or widget)
- X-axis = days within the sprint / milestone date range
- Y-axis = remaining work (task count, or story points if the list uses them)
- Two lines: **Ideal burndown** (linear from total → 0) and **Actual burndown** (tasks closed per day)
- Date range defaults to the List's start/due date or Epic start/due date; user can override
- Chart is scoped to the selected List or Epic (not workspace-wide)

---

## R-03 · CSV Export of Task Report

**As a** workspace admin,
**I want to** export tasks as a CSV report,
**So that** I can feed data into external systems or perform deep analysis.

### Acceptance Criteria
- Export button available on: Project task view, List view, and Analytics page
- Exported columns: task key, title, list name, status, priority, assignees, reporter, start date, due date, closed date, story points, time tracked, epic name, custom field values
- Filters applied to the current view are respected (only export what is visible / filtered)
- File name format: `{project-slug}-tasks-{YYYY-MM-DD}.csv`
- Large exports (> 500 tasks) are streamed; the UI shows a "Preparing export…" toast while the file downloads
- CSV uses UTF-8 with BOM for compatibility with Excel
