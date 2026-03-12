# User Stories: Organization & Team (M-01 ~ M-04)

## 3.1 Organization & Team Management

| ID | As a... | I want to... | So that... |
|----|---------|--------------|------------|
| M-01 | Manager | Create an Organization and multiple Teams under it | I can isolate permissions by department or business line |
| M-02 | Manager | Invite members to the Organization and assign roles (Admin / Member / Guest) | Control overall access level |
| M-03 | Manager | Add members to specific Teams and set their Team-level role | Fine-tune permission boundaries per team |
| M-04 | PM | Set a Space / List to be visible only to specific Teams | Different teams see only their relevant work |

## Implementation Notes

### M-01 — Hierarchy
```
Organization → Workspace → Team → Space/Project → List
```
- `Team` table: `id`, `workspace_id`, `name`, `created_by`
- `TeamMember` table: `team_id`, `user_id`, `role` (team_admin / team_member)

### M-02 — Workspace Roles
Invite flow: send invite email → user accepts → `WorkspaceMember` row created
Roles: `owner` / `admin` / `member` / `guest`

### M-03 — Team Roles
`TeamMember.role`: `team_admin` | `team_member`
Team admins can manage team membership and set Space/List visibility for their team.

### M-04 — Space/List Visibility
- `List` has optional `team_ids UUID[]` (empty = visible to all workspace members)
- On every list/task read: check if user is a member of any team in `team_ids`
- Workspace `admin` and `owner` bypass team visibility restrictions
