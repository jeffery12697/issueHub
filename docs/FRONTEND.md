# Frontend Architecture

## Stack
- **Framework**: React + Vite
- **Language**: TypeScript
- **Data fetching**: TanStack Query v5
- **UI state**: Zustand
- **Drag-and-drop**: `@dnd-kit/core` + `@dnd-kit/sortable`
- **Routing**: React Router v6
- **Markdown editor**: Tiptap (with @mention extension)

See `docs/PROJECT_STRUCTURE.md` for full folder layout.

## Key UI Patterns

### Board View (Kanban)
- Each column = one `ListStatus`
- Drag-drop via `@dnd-kit`; optimistic PATCH on drop, revert on API failure

### SubtaskTree
- Recursive component with collapse/expand
- Fetches flat list from `GET /tasks/{id}/tree`, builds client-side `Map<id, Task[]>`

### CustomFieldInput
- Switch-rendered by `field_type`: text / number / date / dropdown / checkbox / URL
- Respects `visibility_roles` / `editable_roles` from API response (not rendered if not returned)

### ActivityTimeline
- Merged audit + comments, virtualized list
- Real-time updates via WebSocket subscription

## Conventions
- Never use `toISOString().slice()` or locale hacks for dates — see `CLAUDE.md` Timezone section
- Use explicit `getFullYear()` / `getMonth()` / `getDate()` for all date boundary logic
- Optimistic updates via TanStack Query `useMutation` + `onMutate` / `onError` rollback
