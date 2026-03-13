# Time Management User Stories (TM)

| #     | As a...  | I want to...                                                                     | So that...                                      |
|-------|----------|----------------------------------------------------------------------------------|-------------------------------------------------|
| TM-01 | Engineer | Set a due date and start date on a task                                          | I have a clear delivery window                  |
| TM-02 | PM       | View tasks on a Gantt / Timeline view                                            | I can plan sprints and milestones visually      |
| TM-03 | Engineer | Log time on a task (manually or with a live timer)                               | I can track actual hours spent                  |
| TM-04 | PM       | Set story points on a task and calculate sprint velocity                         | I can accurately estimate future sprint capacity |

## Notes

- **TM-01** — `due_date` is already implemented (backend + frontend). `start_date` field needs to be added to the Task model, schema, and TaskDetailPage sidebar.
- **TM-02** — Requires a new Timeline/Gantt view page. Needs `start_date` + `due_date` on tasks. Consider a library like `react-gantt-chart` or a custom SVG-based renderer.
- **TM-03** — Needs a new `TimeEntry` model (task_id, user_id, started_at, stopped_at, duration_seconds, note). UI: manual log form + optional live timer in TaskDetailPage.
- **TM-04** — Add `story_points: int | None` field to Task. Sprint grouping UI on the board/list view. Velocity chart in analytics.
