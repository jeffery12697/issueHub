# Data Model

## Entity Hierarchy
```
Workspace (1) ──< Project (N)
Project   (1) ──< List (N)
Project   (1) ──< Epic (N)   [feature grouping for PMs]
List      (1) ──< Task (N)
Task      (1) ──< Task (N)  [self-referential subtasks]
Task      (N) ──> Epic (1)  [nullable — feature ownership]
```

## Core Tables

### User
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| email | TEXT UNIQUE NOT NULL | |
| display_name | TEXT | |
| avatar_url | TEXT | |
| created_at | TIMESTAMPTZ | |

### WorkspaceMember
| Column | Type | Notes |
|--------|------|-------|
| workspace_id | UUID FK | |
| user_id | UUID FK | |
| role | ENUM | owner / admin / member / guest |

### Task
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| workspace_id | UUID FK | |
| project_id | UUID FK | |
| list_id | UUID FK | nullable after promote |
| parent_task_id | UUID FK self-ref | nullable = root task |
| title | TEXT NOT NULL | |
| description | TEXT | |
| status_id | UUID FK → ListStatus | |
| priority | ENUM | none / low / medium / high / urgent |
| assignee_ids | UUID[] | multi-assignee |
| reviewer_id | UUID FK → User | nullable |
| reporter_id | UUID FK → User | |
| due_date | TIMESTAMPTZ | |
| order_index | FLOAT | fractional indexing |
| depth | INT | denormalized; 0 = root |
| path | LTREE | e.g. `rootId.childId.grandchildId` |
| is_archived | BOOL DEFAULT false | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### Epic
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| project_id | UUID FK → Project | |
| workspace_id | UUID FK | denormalized for query perf |
| name | TEXT NOT NULL | |
| description | TEXT | |
| color | VARCHAR(7) | hex, for timeline display |
| status | ENUM | not_started / in_progress / done |
| start_date | TIMESTAMPTZ | nullable |
| due_date | TIMESTAMPTZ | nullable |
| order_index | FLOAT | for manual sort in overview |
| created_by | UUID FK → User | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

> Task gains a nullable `epic_id UUID FK → Epic` column.
> Deleting an Epic sets `task.epic_id = NULL` (ON DELETE SET NULL).

### TaskDependency
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| blocker_task_id | UUID FK → Task | |
| blocked_task_id | UUID FK → Task | |
| dependency_type | ENUM | blocks / relates_to / duplicates |
| created_by | UUID FK → User | |
| created_at | TIMESTAMPTZ | |

### ListStatus
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| list_id | UUID FK → List | |
| name | TEXT NOT NULL | |
| color | VARCHAR(7) | hex |
| order_index | FLOAT | |
| is_complete | BOOL DEFAULT false | |
| category | ENUM | not_started / active / done / cancelled |

### StatusMapping
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| from_list_id | UUID FK → List | |
| to_list_id | UUID FK → List | |
| from_status_id | UUID FK → ListStatus | |
| to_status_id | UUID FK → ListStatus | |

### CustomFieldDefinition
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| list_id | UUID FK → List | |
| name | TEXT NOT NULL | |
| field_type | ENUM | text / number / date / dropdown / checkbox / url |
| options | JSONB | for dropdown: `[{value, label, color}]` |
| is_required | BOOL DEFAULT false | |
| order_index | FLOAT | |
| visibility_roles | TEXT[] | empty = all roles |
| editable_roles | TEXT[] | |

### CustomFieldValue
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| task_id | UUID FK → Task | |
| field_id | UUID FK → CustomFieldDefinition | |
| value_text | TEXT | |
| value_number | NUMERIC | |
| value_date | TIMESTAMPTZ | |
| value_boolean | BOOL | |
| value_json | JSONB | for dropdown selections |

### AuditLog (append-only, partitioned monthly)
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| task_id | UUID FK → Task | |
| actor_id | UUID FK → User | |
| action | ENUM | created / updated / commented / status_changed / assignee_changed / moved / promoted / subtask_added / dependency_added / dependency_removed / attachment_added / attachment_removed / link_added / link_removed / custom_field_updated |
| field_name | TEXT | for `updated`: which field changed |
| old_value | JSONB | |
| new_value | JSONB | |
| metadata | JSONB | e.g. `{from_list_id, to_list_id}` for moves |
| created_at | TIMESTAMPTZ NOT NULL | partition key |

### Comment
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| task_id | UUID FK → Task | |
| author_id | UUID FK → User | |
| body | TEXT NOT NULL | markdown |
| parent_comment_id | UUID FK self-ref | threaded replies |
| mentions | UUID[] | parsed @mention user IDs |
| is_edited | BOOL DEFAULT false | |
| is_deleted | BOOL DEFAULT false | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

## Key Indexes
- `AuditLog(task_id, created_at DESC)` — primary audit query pattern
- `Task.path` — GiST index for `ltree` subtree/ancestor queries
- `CustomFieldValue(task_id, field_id)` — UNIQUE, also used for filter joins
- `CustomFieldValue(value_number)`, `CustomFieldValue(value_date)` — for range filters

## ltree Path Rules
- On task create: `path = parent.path || task.id` (or just `task.id` for root)
- On subtask promote: update task path + all descendant paths in one transaction
- Query all descendants: `WHERE path <@ 'root_id'`
- Query immediate children: `WHERE path ~ 'root_id.*{1}'`
