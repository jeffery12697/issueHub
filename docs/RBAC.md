# Role-Based Access Control (RBAC)

## Hierarchy
```
Organization
  └── Workspace
        ├── Team (A)
        │     ├── Space / Project
        │     └── List
        └── Team (B)
              └── ...
```

## Roles

### Workspace-level roles
| Role | Capabilities |
|------|-------------|
| `owner` | All permissions including delete workspace |
| `admin` | Manage members, teams, projects, custom fields, templates |
| `member` | Create/edit tasks, comments, custom field values |
| `guest` | Read-only (or scoped write if explicitly granted per List) |

### Team-level roles
| Role | Capabilities |
|------|-------------|
| `team_admin` | Manage team membership, set Space/List visibility for the team |
| `team_member` | Access Spaces/Lists the team has visibility to |

## Scoping Rules
- A Space or List can be restricted to specific Teams (M-04)
- If a List is team-restricted, only members of that team (or workspace `admin`/`owner`) can see it
- Custom field `visibility_roles` and `editable_roles` are workspace-level role names

## Enforcement Checklist
- [ ] Workspace membership check on every request (middleware)
- [ ] Team membership check when accessing restricted Spaces/Lists
- [ ] Custom field visibility filtered from API response (never sent to unauthorized roles)
- [ ] Custom field editability rejected at service layer with HTTP 403
- [ ] Audit log records actor identity and role at time of action
