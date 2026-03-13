# Frontend Architecture

## Stack
- **Framework**: React + Vite
- **Language**: TypeScript
- **Data fetching**: TanStack Query v5
- **UI state**: Zustand
- **Drag-and-drop**: `@dnd-kit/core` + `@dnd-kit/sortable`
- **Routing**: React Router v6
- **Markdown editor**: Tiptap (with @mention extension)
- **Forms**: React Hook Form
- **Styling**: Tailwind CSS + `clsx` / `cva`

See `docs/PROJECT_STRUCTURE.md` for full folder layout.

---

## Architecture Rules

### Component Structure
- **Views** (`src/views/`) — route-level pages only; fetch data, compose components, no inline logic
- **Components** (`src/components/`) — reusable UI; receive props, emit callbacks; no direct API calls
- **Hooks** (`src/hooks/`) — encapsulate data fetching, derived state, and side effects; used by views
- A component that needs server data should receive it as props — let the view or hook own the fetch

### Data Fetching (TanStack Query)
- All server state lives in TanStack Query — never duplicate it in Zustand
- One query hook per resource, e.g. `useTask(id)`, `useListTasks(listId)`
- Mutations use `onMutate` for optimistic updates and `onError` to roll back
- Invalidate related queries after mutation — do not manually merge cache entries
- Never call `fetch` or `axios` directly in a component — always go through a query/mutation hook

### Client State (Zustand)
- Zustand is for **UI state only** — open panels, selected items, drag state, modal visibility
- Never store server data in Zustand (that belongs in TanStack Query cache)
- One slice per domain: `taskSlice`, `boardSlice`, `uiSlice`

### API Layer (`src/api/`)
- All Axios calls live in `src/api/` — one file per resource (`tasks.ts`, `lists.ts`, etc.)
- The Axios instance in `client.ts` handles JWT injection and 401 refresh transparently
- API functions return typed response data — never `any`
- Query hooks in `src/api/` wrap these functions with `useQuery` / `useMutation`

### TypeScript
- No `any` — use `unknown` and narrow, or define a proper type
- API response types are derived from Pydantic response schemas — keep them in sync
- Prefer `type` over `interface` for data shapes; use `interface` only for extendable contracts
- All props must be explicitly typed — no implicit prop spreading without a type

### DRY
- When the same JSX or logic appears in 2+ components, extract it immediately into a shared component or hook
- Do not copy-paste across files

### Error Handling
- Mutations show a toast on error — never silently swallow API errors
- Optimistic updates must always have an `onError` rollback
- 401 responses trigger a token refresh via the Axios interceptor; on refresh failure, redirect to login
- 403 responses show a permission error in-place — do not redirect

### Forms
- Use **React Hook Form** for all forms
- Validation runs client-side first (mirrors server-side rules), then show server 422 errors field-by-field
- Never disable the submit button during submission — show a loading state instead

### Styling
- **Tailwind CSS** — utility classes only; no custom CSS files unless absolutely necessary
- No inline `style={{}}` props except for dynamic values that cannot be expressed as Tailwind classes (e.g. computed colors from API)
- Component variants use `clsx` or `cva` — not ternary string concatenation

---

## Key UI Patterns

### Board View (Kanban)
- Each column = one `ListStatus`
- Drag-drop via `@dnd-kit`; optimistic PATCH on drop, revert on API failure

### SubtaskTree
- Recursive component with collapse/expand
- Fetches flat list from `GET /tasks/{id}/tree`, builds client-side `Map<id, Task[]>`

### CustomFieldInput
- Switch-rendered by `field_type`: text / number / date / dropdown / checkbox / URL
- Respects `visibility_roles` / `editable_roles` from API response — not rendered if field not returned

### TaskLinks
- `api/links.ts` — `useTaskLinks`, `useAddLink`, `useDeleteLink` hooks
- Links card on `TaskDetailPage` (left column); add URL + optional title, clickable, delete
- `useAddLink` invalidates both `['links', taskId]` and `['audit', taskId]` on success

### ActivityTimeline
- Merged audit + comments, virtualized list
- Real-time updates via WebSocket subscription
- `link_added` / `link_removed` audit entries suppress change details — show action name only

---

## Conventions
- Never use `toISOString().slice()` or locale hacks for dates — see `CLAUDE.md` Timezone section
- Use explicit `getFullYear()` / `getMonth()` / `getDate()` for all date boundary logic
- Optimistic updates via TanStack Query `useMutation` + `onMutate` / `onError` rollback
