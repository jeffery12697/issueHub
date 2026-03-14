import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { tasksApi, type Priority, type Task } from '@/api/tasks'
import { listsApi } from '@/api/lists'
import { projectsApi } from '@/api/projects'
import { useWorkspaceMembers, type Member } from '@/api/workspaces'
import HeaderActions from '@/components/HeaderActions'

const PRIORITY_DOT_COLORS: Record<Priority, string> = {
  none: '#cbd5e1', low: '#38bdf8', medium: '#fbbf24', high: '#f97316', urgent: '#ef4444',
}
const PRIORITIES: Priority[] = ['none', 'low', 'medium', 'high', 'urgent']
const PAGE_SIZE = 50

const LIST_BADGE_COLORS = [
  'bg-violet-100 text-violet-700',
  'bg-sky-100 text-sky-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-indigo-100 text-indigo-700',
]
function listBadgeColor(name: string) {
  return LIST_BADGE_COLORS[name.charCodeAt(0) % LIST_BADGE_COLORS.length]
}

export default function ProjectTasksPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()

  const [listFilter, setListFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState<Priority | ''>('')
  const [includeSubtasks, setIncludeSubtasks] = useState(false)
  const [page, setPage] = useState(1)

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.get(projectId!),
    enabled: !!projectId,
  })

  const { data: lists = [] } = useQuery({
    queryKey: ['lists', projectId],
    queryFn: () => listsApi.list(projectId!),
    enabled: !!projectId,
  })

  const { data: listDetails = [] } = useQuery({
    queryKey: ['lists-with-statuses', projectId],
    queryFn: () => Promise.all(lists.map((l) => listsApi.get(l.id))),
    enabled: lists.length > 0,
  })

  const statusMap = Object.fromEntries(
    listDetails.flatMap((l) => (l.statuses ?? []).map((s) => [s.id, s]))
  )
  const listMap = Object.fromEntries(lists.map((l) => [l.id, l]))

  const { data: result, isLoading } = useQuery({
    queryKey: ['project-tasks', projectId, listFilter, priorityFilter, includeSubtasks, page],
    queryFn: () => tasksApi.listForProject(projectId!, {
      page,
      page_size: PAGE_SIZE,
      list_id: listFilter || undefined,
      priority: (priorityFilter as Priority) || undefined,
      include_subtasks: includeSubtasks,
    }),
    enabled: !!projectId,
  })

  const tasks = result?.items ?? []
  const total = result?.total ?? 0
  const totalPages = Math.ceil(total / PAGE_SIZE)

  const workspaceId = project?.workspace_id
  const { data: members = [] } = useWorkspaceMembers(workspaceId)
  const memberMap = Object.fromEntries(members.map((m) => [m.user_id, m]))

  const hasFilters = !!(listFilter || priorityFilter)
  function resetPage() { setPage(1) }
  function clearFilters() { setListFilter(''); setPriorityFilter(''); resetPage() }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 h-16 flex items-center gap-3">
        <Link to="/" className="text-slate-400 hover:text-slate-600 text-sm transition-colors">← Home</Link>
        <span className="text-slate-300">/</span>
        <Link
          to={`/workspaces/${project?.workspace_id}`}
          className="text-slate-400 hover:text-slate-600 text-sm transition-colors"
        >
          {project?.name}
        </Link>
        <span className="text-slate-300">/</span>
        <span className="text-sm font-medium text-slate-800">All Tasks</span>
        <div className="ml-auto flex items-center gap-3">
          <Link
            to={`/projects/${projectId}/analytics`}
            className="text-sm text-slate-500 hover:text-violet-600 font-medium transition-colors"
          >
            Analytics
          </Link>
          <HeaderActions />
        </div>
      </header>

      <main className="max-w-5xl mx-auto py-8 px-6">
        <div className="mb-5">
          <h2 className="text-2xl font-bold text-slate-900">{project?.name}</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            {total} task{total !== 1 ? 's' : ''}
            {totalPages > 1 && <span> · page {page} of {totalPages}</span>}
          </p>
        </div>

        {/* Filter bar */}
        <div className="mb-5 flex items-center gap-2 flex-wrap">
          <span className="text-sm text-slate-400 font-medium shrink-0">Filter</span>
          <div className="w-px h-4 bg-slate-200 shrink-0" />

          <FilterSelect
            value={listFilter}
            onChange={(v) => { setListFilter(v); resetPage() }}
            label="List"
            active={!!listFilter}
            activeLabel={listFilter ? listMap[listFilter]?.name : undefined}
          >
            <option value="">All lists</option>
            {lists.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </FilterSelect>

          <FilterSelect
            value={priorityFilter}
            onChange={(v) => { setPriorityFilter(v as Priority | ''); resetPage() }}
            label="Priority"
            active={!!priorityFilter}
            activeLabel={priorityFilter || undefined}
          >
            <option value="">All priorities</option>
            {PRIORITIES.filter((p) => p !== 'none').map((p) => (
              <option key={p} value={p} className="capitalize">{p}</option>
            ))}
          </FilterSelect>

          <label className="flex items-center gap-2 text-sm text-slate-500 cursor-pointer select-none ml-1">
            <input
              type="checkbox"
              checked={includeSubtasks}
              onChange={(e) => { setIncludeSubtasks(e.target.checked); resetPage() }}
              className="w-3.5 h-3.5 rounded border-slate-300 text-violet-600"
            />
            Subtasks
          </label>

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="h-8 flex items-center gap-1 text-xs text-slate-400 hover:text-red-500 transition-colors px-2 rounded-full hover:bg-red-50"
            >
              <span>✕</span> Clear
            </button>
          )}
        </div>

        {/* Table */}
        {isLoading ? (
          <p className="text-slate-400 text-sm">Loading...</p>
        ) : tasks.length === 0 ? (
          <div className="text-center py-20 bg-white border border-dashed border-slate-200 rounded-2xl">
            <p className="text-slate-700 font-medium mb-1">No tasks found</p>
            <p className="text-slate-400 text-sm">
              {hasFilters ? 'Try adjusting your filters.' : 'Tasks in this project will appear here.'}
            </p>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Title</th>
                  <th className="text-left px-4 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">List</th>
                  <th className="text-left px-4 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Priority</th>
                  <th className="text-left px-4 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Assignees</th>
                  <th className="text-left px-4 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Reviewer</th>
                  <th className="text-left px-4 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Due Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tasks.map((task: Task) => {
                  const list = task.list_id ? listMap[task.list_id] : null
                  const status = task.status_id ? statusMap[task.status_id] : null
                  return (
                    <tr key={task.id} className="hover:bg-slate-50 transition-colors">
                      {/* Title */}
                      <td className={`px-4 py-3 ${task.parent_task_id ? 'pl-10' : ''}`}>
                        {task.parent_task_id && (
                          <div className="text-xs text-slate-300 mb-0.5">↳</div>
                        )}
                        <button
                          onClick={() => navigate(`/tasks/${task.id}`)}
                          className="text-left font-semibold text-slate-800 hover:text-violet-600 transition-colors"
                        >
                          {task.title}
                        </button>
                      </td>

                      {/* List badge */}
                      <td className="px-4 py-3">
                        {list ? (
                          <Link
                            to={`/projects/${projectId}/lists/${list.id}`}
                            className={`inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap ${listBadgeColor(list.name)}`}
                          >
                            {list.name}
                          </Link>
                        ) : (
                          <span className="text-slate-300 text-sm">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        {status ? (
                          <span
                            className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
                            style={{ backgroundColor: status.color + '20', color: status.color }}
                          >
                            {status.name}
                          </span>
                        ) : (
                          <span className="text-slate-300 text-sm">—</span>
                        )}
                      </td>

                      {/* Priority */}
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-2 text-sm font-medium capitalize text-slate-600">
                          <span
                            className="w-2.5 h-2.5 rounded-full inline-block shrink-0"
                            style={{ backgroundColor: PRIORITY_DOT_COLORS[task.priority] }}
                          />
                          {task.priority === 'none' ? '—' : task.priority}
                        </span>
                      </td>

                      {/* Assignees */}
                      <td className="px-4 py-3">
                        <AvatarStack ids={task.assignee_ids} memberMap={memberMap} />
                      </td>

                      {/* Reviewer */}
                      <td className="px-4 py-3">
                        {task.reviewer_id && memberMap[task.reviewer_id] ? (
                          <Avatar member={memberMap[task.reviewer_id]} title="Reviewer" />
                        ) : (
                          <span className="text-slate-300 text-sm">—</span>
                        )}
                      </td>

                      {/* Due date */}
                      <td className="px-4 py-3">
                        <DueDateBadge
                          dueDate={task.due_date}
                          statusComplete={status?.is_complete}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-slate-400">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                ← Prev
              </button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                const p = totalPages <= 7 ? i + 1 : page <= 4 ? i + 1 : page >= totalPages - 3 ? totalPages - 6 + i : page - 3 + i
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-8 h-8 text-sm rounded-lg border transition-colors ${
                      p === page
                        ? 'bg-violet-600 text-white border-violet-600'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {p}
                  </button>
                )
              })}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

// ── Shared cell components (mirror of ListPage) ────────────────────────────────

function Avatar({ member, title }: { member: Member; title?: string }) {
  return (
    <span
      title={`${title ? title + ': ' : ''}${member.display_name}`}
      className="inline-flex w-7 h-7 rounded-full bg-violet-100 text-violet-700 text-xs font-semibold items-center justify-center border-2 border-white shadow-sm select-none"
    >
      {member.display_name[0].toUpperCase()}
    </span>
  )
}

function AvatarStack({ ids, memberMap }: { ids: string[]; memberMap: Record<string, Member> }) {
  if (ids.length === 0) return <span className="text-slate-300 text-sm">—</span>
  return (
    <div className="flex -space-x-1.5">
      {ids.slice(0, 4).map((id) =>
        memberMap[id] ? <Avatar key={id} member={memberMap[id]} /> : null
      )}
      {ids.length > 4 && (
        <span className="inline-flex w-7 h-7 rounded-full bg-slate-100 text-slate-500 text-xs font-semibold items-center justify-center border-2 border-white shadow-sm">
          +{ids.length - 4}
        </span>
      )}
    </div>
  )
}

function DueDateBadge({ dueDate, statusComplete }: { dueDate: string | null; statusComplete: boolean | undefined }) {
  if (!dueDate) return <span className="text-slate-300 text-xs">—</span>
  const today = new Date()
  const due = new Date(dueDate)
  const todayStr = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`
  const dueStr = `${due.getFullYear()}-${due.getMonth()}-${due.getDate()}`
  const isOverdue = !statusComplete && dueStr < todayStr
  const isDueToday = !statusComplete && dueStr === todayStr
  const label = due.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: due.getFullYear() !== today.getFullYear() ? 'numeric' : undefined })
  if (statusComplete) return <span className="text-xs text-slate-400">{label}</span>
  if (isOverdue) return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
      <span>⚠</span> {label}
    </span>
  )
  if (isDueToday) return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
      Today
    </span>
  )
  return <span className="text-xs text-slate-500">{label}</span>
}

function FilterSelect({
  value, onChange, label, active, activeLabel, children,
}: {
  value: string
  onChange: (v: string) => void
  label: string
  active: boolean
  activeLabel?: string
  children: React.ReactNode
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`h-9 appearance-none pl-3.5 pr-8 rounded-full text-sm font-medium border cursor-pointer focus:outline-none focus:ring-2 focus:ring-violet-500 transition-colors ${
          active
            ? 'border-violet-400 bg-violet-50 text-violet-700'
            : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700'
        }`}
      >
        {children}
      </select>
      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-current opacity-60">▾</span>
    </div>
  )
}
