# Frontend Architecture

## Stack
- **Framework**: React + Vite
- **Language**: TypeScript
- **Data fetching**: TanStack Query v5
- **UI state**: Zustand
- **Drag-and-drop**: `@dnd-kit/core` + `@dnd-kit/sortable`
- **Routing**: React Router v6
- **Rich text editor**: Tiptap (`RichTextEditor.tsx` — Bold, Italic, Underline, Strike, Code, H1–H3, lists, blockquote, code block, HR, undo/redo)
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
- **Paginated endpoints**: use `listPaged()` variant (e.g. `tasksApi.listPaged()`) — sends `page`/`page_size` params, reads `X-Total-Count` header from the raw Axios response, returns `{ items: T[], total: number }`

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
- Each column = one `ListStatus`; columns centered with `flex justify-center` + `min-w-max`
- Drag-drop via HTML5 native `draggable` / `onDragStart` / `onDrop`; PATCH status on drop
- Inline "Add task" form per column; "No Status" column for tasks with null `status_id`
- Cards show: priority accent bar + badge, story points, due date (overdue/today coloring), assignee avatars, subtask count

### Subtasks in ListPage
- List endpoint called with `include_subtasks=true` to fetch parents + subtasks in one request
- Client-side grouping: parent tasks in order, each immediately followed by its subtasks; orphaned subtasks appended at end
- Subtask rows: indented (`pl-10`), `↳ Parent title` breadcrumb (clickable, navigates to parent)

### CustomFieldInput
- Switch-rendered by `field_type`: text / number / date / dropdown / checkbox / URL
- Respects `visibility_roles` / `editable_roles` from API response — not rendered if field not returned

### TaskLinks
- `api/links.ts` — `useTaskLinks`, `useAddLink`, `useDeleteLink` hooks
- Links rendered in the **Links tab** on `TaskDetailPage`; add URL + optional title, clickable, delete
- `useAddLink` invalidates both `['links', taskId]` and `['audit', taskId]` on success

### ActivityTimeline
- Audit log rendered as a timeline below comments on `TaskDetailPage`
- `link_added` / `link_removed` audit entries suppress change details — show action name only

### TaskDetailPage layout
- **Left column**: borderless title (inline edit on click) + `RichTextEditor` description (saves on blur, not on keystroke), then a tabbed card (Subtasks / Blocked by / Links / Fields / Time), then Comments thread, then History timeline
- **Right sidebar** (`w-64`): Status pill group, Priority pill group, Assignees multi-select, Reviewer select, Start Date picker, Story Points input, Watch toggle
- History: description changes shown as "edited" (not raw HTML diff); single-element change arrays mean no old→new comparison
- Query cache cleared on logout via `qc.clear()` in `HeaderActions`

### ListPage filter bar & pagination
- Pill-shaped `FilterSelect` component wraps native `<select>` with custom chevron and active (violet) highlight
- Status + Priority filters always shown; custom field filters appended after
- Active filters highlighted in violet; "✕ Clear" button appears when any filter is set; any filter change resets to page 1
- Pagination: `tasksApi.listPaged()` sends `page`/`page_size=50` params and reads `X-Total-Count` response header; prev/next + numbered page buttons shown when `totalPages > 1`

### WorkspaceMember management
- `GET /auth/users/search?email=` — look up user by exact email (any authenticated user)
- `WorkspaceSettingsPage` has a **Members tab** (default): search by email → preview result → pick role → Add
- Only workspace **owner** can invite new members (admins get 403)
- Members tab also shows current members with role selector and remove button

### Dev login
- `POST /dev/token?email=&display_name=` — creates or fetches user, returns JWT; gated by `ALLOW_DEV_LOGIN` env var (default `true`)
- Login page shows a dev form (email + display name) when `VITE_ALLOW_DEV_LOGIN !== 'false'`
- New email → new account with its own workspace; existing email → log back in

---

## Conventions
- Never use `toISOString().slice()` or locale hacks for dates — see `CLAUDE.md` Timezone section
- Use explicit `getFullYear()` / `getMonth()` / `getDate()` for all date boundary logic
- Optimistic updates via TanStack Query `useMutation` + `onMutate` / `onError` rollback
