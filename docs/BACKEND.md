# Backend Architecture

## Stack
- **Framework**: FastAPI (Python)
- **ORM**: SQLAlchemy 2.0 async
- **Migrations**: Alembic
- **Database**: PostgreSQL (with `ltree` extension)
- **Cache / Pub-Sub**: Redis (`redis.asyncio`)
- **Auth**: Google OAuth 2.0 via `authlib` + JWT via `python-jose`
- **Validation**: Pydantic v2

---

## Architecture Rules

### API-First
- Route handlers return JSON via Pydantic **response schemas** (Resources)
- SPA consumes all data through API endpoints — no server-rendered views

### Feature-First Structure
Code is organized by feature module, not by layer:
```
app/features/{Module}/
  router.py        # FastAPI route handlers (thin)
  service.py       # Business logic
  repository.py    # All SQLAlchemy queries
  schemas.py       # Pydantic request schemas + response schemas (DTOs/Resources)
  models.py        # SQLAlchemy model (if module-specific) or import from shared
```

### Route Handlers (Controllers)
- **Thin** — validate input, call service, return response schema. Nothing else.
- Inject concrete service/repository classes via FastAPI `Depends()` — no abstract interfaces unless a proven second implementation exists
- Never contain business logic or query logic

### Services
- Orchestrate repositories + business rules
- Dispatch events/background tasks **explicitly** — no implicit hooks or lifecycle observers
- Depend on concrete repository classes (not interfaces)
- Accept **DTOs** as parameters, never raw dicts or request schemas directly

### Repositories
- **All SQLAlchemy queries live here** — `session.query()` / `select()` / `insert()` etc.
- No SQLAlchemy queries outside of repository classes (no `session.execute()` in services or routes)
- Enable `lazy="raise"` on all relationships in dev to catch lazy loading — load explicitly with `selectinload` / `joinedload`
- Cross-feature access: import the concrete repository of the other feature, never query its model directly

### Soft Delete
- All models include a `deleted_at TIMESTAMPTZ` column (nullable)
- Use a shared `SoftDeleteMixin` that adds `deleted_at` and a `is_deleted` property
- Repositories must filter `WHERE deleted_at IS NULL` by default on all queries
- Hard deletes are not permitted — use soft delete only
- Restoring a record sets `deleted_at = NULL`

### DRY
- When the same logic appears in 2+ places during implementation, extract it immediately into a Service, mixin, helper, or base class
- Do NOT copy-paste logic across files — refactor at the point of duplication

### Concrete Classes Only
- No abstract base classes or interfaces unless there is a **proven, existing** second implementation
- Dependency injection via FastAPI `Depends()` with concrete classes

### DTOs
- Defined as `@dataclass(frozen=True)` (immutable)
- Used as service/repository method parameters — not Pydantic request schemas
- No inheritance. Tests construct them directly with keyword arguments.
- Example:
  ```python
  @dataclass(frozen=True)
  class CreateTaskDTO:
      title: str
      list_id: UUID
      priority: Priority
      reporter_id: UUID
  ```

### Models
- Relationships, column definitions, casts, and simple `@property` helpers only
- **No query logic** — that belongs in the repository
- Cross-feature: model class may be referenced for type hints; never call query methods on it outside its own repository

See `docs/PROJECT_STRUCTURE.md` for full folder layout.

---

## API Conventions
- Base path: `/api/v1`
- All endpoints require `Authorization: Bearer <token>` except `/auth/*`
- Custom field filters: `?cf[{field_id}]=value`, `?cf[{field_id}][gte]=value`
- Cursor-based pagination for audit/comment feeds (never offset)
- HTTP 422 for validation errors with structured field-level messages

## Database Rules
- All multi-step mutations must be wrapped in a single DB transaction
- Audit entries written via FastAPI `BackgroundTask` (non-blocking)
- Use `ltree` path column on Task for subtree queries — never raw recursive CTEs
- Append-only `AuditLog` table — no UPDATE or DELETE permitted
- `AuditLog` partitioned monthly by `created_at`
- Index `AuditLog` on `(task_id, created_at DESC)`
- Float fractional indexing for `order_index`; rebalance when gap < 0.001

## Testing

### Rules
- **Every new feature must include tests.** Adding an endpoint, service method, or repository query without a corresponding test is not acceptable.
- Test files live in `backend/tests/test_{feature}.py`
- Use `pytest` + `httpx.AsyncClient` (via `ASGITransport`) for full integration tests — test through the HTTP layer, not service classes directly
- Test database: `issuehub_test` (separate from dev DB). Schema is created once per session; tables are truncated between tests for isolation.
- Run with: `docker compose exec backend pytest -v`

### What to test per feature
For each new feature, cover:
1. **Happy path** — the endpoint works and returns the expected shape
2. **Auth / access control** — unauthenticated → 403, non-member → 403
3. **Validation / edge cases** — invalid input, duplicate records, constraint violations
4. **Side effects** — e.g. audit log written, soft delete excludes from list queries

### Shared fixtures (`tests/conftest.py`)
| Fixture | What it provides |
|---------|-----------------|
| `db` | `AsyncSession` for the test, tables truncated after |
| `client` | `httpx.AsyncClient` with `get_session` overridden to use `db` |
| `user` | A persisted `User` row |
| `workspace` | A `Workspace` with `user` as owner |
| `project` | A `Project` in `workspace` |
| `list_` | A `List` in `project` |
| `headers` | `Authorization: Bearer <token>` for `user` |

Helper functions `make_user()`, `make_workspace()`, `make_project()`, `make_list()`, and `auth_headers()` are available for creating additional objects within a test.
