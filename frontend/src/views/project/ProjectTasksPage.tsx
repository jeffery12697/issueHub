import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { tasksApi, type Priority, type Task } from '@/api/tasks'
import { listsApi } from '@/api/lists'
import { projectsApi } from '@/api/projects'
import { useWorkspaceMembers } from '@/api/workspaces'
import HeaderActions from '@/components/HeaderActions'

const PRIORITY_COLORS: Record<Priority, string> = {
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

  // Load statuses for all lists to display per-task status info
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

  function resetPage() { setPage(1) }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 h-16 flex items-center gap-3">
        <Link to="/" className="text-slate-400 hover:text-slate-600 text-sm transition-colors">← Home</Link>
        <span className="text-slate-300">/</span>
        <span className="text-base font-semibold text-slate-800">{project?.name}</span>
        <span className="text-slate-300">/</span>
        <span className="text-sm text-slate-500">All Tasks</span>
        <div className="ml-auto">
          <HeaderActions />
        </div>
      </header>

      <main className="max-w-6xl mx-auto py-6 px-6">
        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <select
            value={listFilter}
            onChange={(e) => { setListFilter(e.target.value); resetPage() }}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white"
          >
            <option value="">All lists</option>
            {lists.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => { setPriorityFilter(e.target.value as Priority | ''); resetPage() }}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white"
          >
            <option value="">All priorities</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
            ))}
          </select>

          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeSubtasks}
              onChange={(e) => { setIncludeSubtasks(e.target.checked); resetPage() }}
              className="w-4 h-4 rounded border-slate-300 text-violet-600"
            />
            Include subtasks
          </label>

          {total > 0 && (
            <span className="ml-auto text-sm text-slate-400">
              {total} task{total !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Table */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="divide-y divide-slate-100">
              {[1,2,3].map((i) => (
                <div key={i} className="h-12 px-4 animate-pulse bg-slate-50" />
              ))}
            </div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-16 text-slate-400 text-sm">
              No tasks found{listFilter || priorityFilter ? ' matching filters' : ' in this project'}.
            </div>
          ) : (
            <>
              {/* Header row */}
              <div className="grid grid-cols-[1fr_140px_90px_150px_100px_110px] gap-3 px-4 py-2 border-b border-slate-100 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                <span>Title</span>
                <span>List</span>
                <span>Priority</span>
                <span>Status</span>
                <span>Assignees</span>
                <span>Due date</span>
              </div>

              <div className="divide-y divide-slate-50">
                {tasks.map((task: Task) => {
                  const list = task.list_id ? listMap[task.list_id] : null
                  const status = task.status_id ? statusMap[task.status_id] : null
                  const assignees = task.assignee_ids.map((id) => memberMap[id]).filter(Boolean)

                  return (
                    <div
                      key={task.id}
                      className="grid grid-cols-[1fr_140px_90px_150px_100px_110px] gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors items-center group"
                    >
                      {/* Title */}
                      <button
                        className="text-sm text-slate-800 hover:text-violet-700 font-medium truncate text-left"
                        onClick={() => navigate(`/tasks/${task.id}`)}
                      >
                        {task.parent_task_id && (
                          <span className="text-slate-400 mr-1.5">↳</span>
                        )}
                        {task.title}
                      </button>

                      {/* List badge */}
                      {list ? (
                        <Link
                          to={`/projects/${projectId}/lists/${list.id}`}
                          className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full truncate max-w-full ${listBadgeColor(list.name)}`}
                          title={list.name}
                        >
                          {list.name}
                        </Link>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}

                      {/* Priority */}
                      <span className="flex items-center gap-1.5 text-xs text-slate-500 capitalize">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: PRIORITY_COLORS[task.priority] }}
                        />
                        {task.priority}
                      </span>

                      {/* Status */}
                      {status ? (
                        <span className="flex items-center gap-1.5 text-xs text-slate-600 truncate">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: status.color }}
                          />
                          {status.name}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-300">No status</span>
                      )}

                      {/* Assignees */}
                      <div className="flex items-center gap-1 overflow-hidden">
                        {assignees.length === 0 ? (
                          <span className="text-xs text-slate-300">—</span>
                        ) : (
                          assignees.slice(0, 3).map((m) => (
                            <span
                              key={m.user_id}
                              className="w-6 h-6 rounded-full bg-violet-200 text-violet-700 text-xs font-bold flex items-center justify-center shrink-0"
                              title={m.display_name}
                            >
                              {m.display_name[0].toUpperCase()}
                            </span>
                          ))
                        )}
                        {assignees.length > 3 && (
                          <span className="text-xs text-slate-400">+{assignees.length - 3}</span>
                        )}
                      </div>

                      {/* Due date */}
                      <span className="text-xs text-slate-500">
                        {task.due_date
                          ? new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                          : '—'}
                      </span>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <span className="text-sm text-slate-400">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
            </span>
            <div className="flex items-center gap-1">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                ← Prev
              </button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                const p = totalPages <= 7 ? i + 1 : page <= 4 ? i + 1 : page + i - 3
                if (p < 1 || p > totalPages) return null
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
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
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
