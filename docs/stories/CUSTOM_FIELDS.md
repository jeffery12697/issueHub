# User Stories: Custom Fields (C-01 ~ C-05)

## 1.3 Custom Fields

| ID | As a... | I want to... | So that... |
|----|---------|--------------|------------|
| C-01 | Manager | Add custom fields on specific lists (text, number, date, dropdown, checkbox, URL) | Different projects have different tracking dimensions |
| C-02 | Engineer | Fill in custom field values for the list the task belongs to | I can record non-standard information |
| C-03 | Manager | Set a custom field as required | Data completeness is ensured |
| C-04 | PM | Filter tasks by custom field values | I can do more precise reporting |
| C-05 | Manager | Set custom fields as visible/editable only by specific roles | Control field access permissions |

## Implementation Notes

### Field Types
`text` | `number` | `date` | `dropdown` | `checkbox` | `url`

### CustomFieldValue — Typed Columns
Separate typed columns (`value_text`, `value_number`, `value_date`, `value_boolean`, `value_json`) allow indexed range queries for number/date filters (C-04). Never store all values as a single TEXT column.

### C-03 — Required Field Validation (server-side)
On `PATCH /tasks/{id}` and `PUT /tasks/{id}/field-values`:
1. Fetch all `CustomFieldDefinition` records for the task's `list_id` where `is_required = true`
2. Verify each has a non-null `CustomFieldValue`
3. Return HTTP 422 with structured error listing missing fields

Cache field definitions per list in Redis; invalidate on schema change.

### C-04 — Filtering
Query parameter convention:
- Exact: `?cf[{field_id}]=value`
- Range: `?cf[{field_id}][gte]=value`, `?cf[{field_id}][lte]=value`

### C-05 — Role-Based Visibility
- `visibility_roles TEXT[]` — empty array = visible to all roles
- `editable_roles TEXT[]` — empty array = editable by all roles
- Backend: filter fields from API response if user role not in `visibility_roles`
- Backend: reject writes with HTTP 403 if user role not in `editable_roles`
- Frontend: does not render fields not returned by API (defense-in-depth)
