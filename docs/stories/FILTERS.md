# Filtering & Search User Stories (F)

| #    | As a...  | I want to...                                                                    | So that...                                          |
|------|----------|---------------------------------------------------------------------------------|-----------------------------------------------------|
| F-01 | Anyone   | Use global search across task titles, descriptions, and comment content         | I can quickly locate any content in the workspace   |
| F-02 | Engineer | Save a custom set of filter conditions as a "saved view"                        | I don't have to re-configure filters every session  |
| F-03 | PM       | Group tasks by assignee, priority, or status                                    | I can flexibly switch between task display dimensions |

## Notes

- **F-01** — Global search should cover task title, description, and comment body. Results should link directly to the task. Consider debounced search with a command-palette style UI (⌘K / Ctrl+K).
- **F-02** — Saved views should persist per-user, per-list (or globally). Each saved view stores the active filter set (field, operator, value tuples). UI: dropdown to load a saved view, button to save current filters as a new view, option to rename/delete.
- **F-03** — Group-by is a frontend rendering concern (tasks already fetched). Groups: assignee (one group per assigned user + unassigned), priority (Urgent / High / Medium / Low / None), status (already implemented as "Group by status" toggle). All group headers should show task count and be collapsible.
