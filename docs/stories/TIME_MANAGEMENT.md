# Time Management User Stories (TM)

| #     | As a... | I want to...                                          | So that...                        |
|-------|---------|-------------------------------------------------------|-----------------------------------|
| TM-01 | 工程師  | 在 task 上設定 due date 與 start date                 | 明確交期範圍                      |
| TM-02 | PM      | 以甘特圖（Timeline view）呈現任務的時間排布           | 我可以規劃 sprint 與里程碑        |
| TM-03 | 工程師  | 在 task 上記錄 time tracking（手動或計時器）          | 統計實際工時                      |
| TM-04 | PM      | 設定 task 的估點（story points）並在 sprint 中做 velocity 計算 | 精準估算後續 sprint 容量 |

## Notes

- **TM-01** — `due_date` is already implemented (backend + frontend). `start_date` field needs to be added to the Task model, schema, and TaskDetailPage sidebar.
- **TM-02** — Requires a new Timeline/Gantt view page. Needs `start_date` + `due_date` on tasks. Consider a library like `react-gantt-chart` or a custom SVG-based renderer.
- **TM-03** — Needs a new `TimeEntry` model (task_id, user_id, started_at, stopped_at, duration_seconds, note). UI: manual log form + optional live timer in TaskDetailPage.
- **TM-04** — Add `story_points: int | None` field to Task. Sprint grouping UI on the board/list view. Velocity chart in analytics.
