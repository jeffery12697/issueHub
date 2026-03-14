import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listsApi } from '@/api/lists'
import { tasksApi, type Task, type Priority } from '@/api/tasks'
import { dependenciesApi } from '@/api/dependencies'
import { useWorkspaceMembers, type Member } from '@/api/workspaces'
import { useListSocket } from '@/hooks/useTaskSocket'
import { useFieldDefinitions } from '@/api/customFields'
import HeaderActions from '@/components/HeaderActions'
import DeleteButton from '@/components/DeleteButton'
import { toast } from '@/store/toastStore'
import { useAuthStore } from '@/store/authStore'

const PRIORITY_DOT_COLORS: Record<Priority, string> = {
  none: '#cbd5e1',
  low: '#38bdf8',
  medium: '#fbbf24',
  high: '#f97316',
  urgent: '#ef4444',
}

const PRIORITIES: Priority[] = ['none', 'low', 'medium', 'high', 'urgent']

export default function ListPage() {
  const { projectId, listId } = useParams<{ projectId: string; listId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()

  useListSocket(listId)

  const { data: list } = useQuery({
    queryKey: ['list', listId],
    queryFn: () => listsApi.get(listId!),
  })

  const [newTitle, setNewTitle] = useState('')
  const [creating, setCreating] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState<Priority | ''>('')
  const [cfFilters, setCfFilters] = useState<Record<string, string>>({})
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 50

  const { data: pagedResult, isLoading } = useQuery({
    queryKey: ['tasks', listId, statusFilter, priorityFilter, cfFilters, page],
    queryFn: () => tasksApi.listPaged(listId!, {
      page,
      page_size: PAGE_SIZE,
      status_id: statusFilter || undefined,
      priority: (priorityFilter as Priority) || undefined,
      cf: cfFilters,
      include_subtasks: true,
    }),
  })

  const allTasks = pagedResult?.items ?? []
  const totalCount = pagedResult?.total ?? 0
  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  const { data: depFlags = {} } = useQuery({
    queryKey: ['task-dep-flags', listId],
    queryFn: () => dependenciesApi.getListFlags(listId!),
    enabled: !!listId,
  })

  // Group: parent tasks in order, each followed by its subtasks
  const tasks = (() => {
    const taskMap = Object.fromEntries(allTasks.map((t) => [t.id, t]))
    const subtasksByParent: Record<string, Task[]> = {}
    allTasks.filter((t) => t.parent_task_id).forEach((t) => {
      if (!subtasksByParent[t.parent_task_id!]) subtasksByParent[t.parent_task_id!] = []
      subtasksByParent[t.parent_task_id!].push(t)
    })
    const result: Task[] = []
    for (const t of allTasks.filter((t) => !t.parent_task_id)) {
      result.push(t)
      if (subtasksByParent[t.id]) result.push(...subtasksByParent[t.id])
    }
    // Orphaned subtasks (parent filtered out) — append at end
    const listedParentIds = new Set(allTasks.filter((t) => !t.parent_task_id).map((t) => t.id))
    for (const t of allTasks.filter((t) => t.parent_task_id)) {
      if (!listedParentIds.has(t.parent_task_id!)) result.push(t)
    }
    return { sorted: result, taskMap }
  })()

  const { sorted: sortedTasks, taskMap } = tasks
  const createTask = useMutation({
    mutationFn: (title: string) => tasksApi.create(listId!, { title }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks', listId] })
      setCreating(false)
      setNewTitle('')
    },
  })

  const deleteTask = useMutation({
    mutationFn: tasksApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks', listId] }),
  })

  const bulkUpdate = useMutation({
    mutationFn: ({ taskIds, data }: { taskIds: string[]; data: { status_id?: string; priority?: string } }) =>
      tasksApi.bulkUpdate(taskIds, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks', listId] })
      setSelectedIds(new Set())
    },
    onError: () => toast.error('Bulk update failed'),
  })

  const bulkDelete = useMutation({
    mutationFn: (taskIds: string[]) => tasksApi.bulkDelete(taskIds),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks', listId] })
      setSelectedIds(new Set())
    },
    onError: () => toast.error('Bulk delete failed'),
  })

  const { data: fieldDefs = [] } = useFieldDefinitions(listId)
  const workspaceId = allTasks[0]?.workspace_id
  const { data: members = [] } = useWorkspaceMembers(workspaceId)
  const memberMap = Object.fromEntries(members.map((m) => [m.user_id, m]))
  const currentUserId = useAuthStore((s) => s.user?.id)
  const myRole = currentUserId ? memberMap[currentUserId]?.role : undefined
  const canManageSettings = myRole === 'owner' || myRole === 'admin'

  const statusMap = Object.fromEntries((list?.statuses ?? []).map((s) => [s.id, s]))

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 h-16 flex items-center gap-3">
        <Link to="/" className="text-slate-400 hover:text-slate-600 text-sm transition-colors">← Home</Link>
        <span className="text-slate-300">/</span>
        <span className="text-base font-semibold text-slate-800">{list?.name}</span>
        <div className="ml-auto flex items-center gap-3">
          {canManageSettings && (
            <Link
              to={`/projects/${projectId}/lists/${listId}/settings`}
              className="text-slate-400 hover:text-slate-600 text-sm transition-colors"
            >
              ⚙ Settings
            </Link>
          )}
          <div className="flex rounded-lg border border-slate-200 overflow-hidden">
            <span className="bg-violet-600 text-white px-3.5 py-2 text-sm font-medium">
              List
            </span>
            <Link
              to={`/projects/${projectId}/lists/${listId}/board`}
              className="bg-white text-slate-500 px-3.5 py-2 text-sm font-medium hover:bg-slate-50 transition-colors"
            >
              Board
            </Link>
          </div>
          <HeaderActions />
        </div>
      </header>

      <main className="max-w-5xl mx-auto py-8 px-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{list?.name}</h2>
            <p className="text-sm text-slate-400 mt-0.5">
              {totalCount} item{totalCount === 1 ? '' : 's'}
              {totalPages > 1 && <span> · page {page} of {totalPages}</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => tasksApi.exportCsv(listId!)}
              className="border border-slate-200 text-slate-600 text-sm px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors font-medium"
            >
              ⬇ Export CSV
            </button>
            <button
              onClick={() => setCreating(true)}
              className="bg-violet-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-violet-700 transition-colors font-medium"
            >
              + New task
            </button>
          </div>
        </div>

        {selectedIds.size > 0 && (
          <div className="mb-4 flex items-center gap-3 bg-violet-50 border border-violet-200 rounded-xl px-4 py-2.5">
            <span className="text-xs font-semibold text-violet-700">{selectedIds.size} selected</span>
            <div className="w-px h-4 bg-violet-200" />
            <select
              className="h-7 text-xs border border-violet-300 rounded-md px-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500"
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) {
                  bulkUpdate.mutate({ taskIds: Array.from(selectedIds), data: { status_id: e.target.value } })
                  e.target.value = ''
                }
              }}
            >
              <option value="" disabled>Set status…</option>
              {(list?.statuses ?? []).map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <select
              className="h-7 text-xs border border-violet-300 rounded-md px-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500"
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) {
                  bulkUpdate.mutate({ taskIds: Array.from(selectedIds), data: { priority: e.target.value } })
                  e.target.value = ''
                }
              }}
            >
              <option value="" disabled>Set priority…</option>
              {(['none', 'low', 'medium', 'high', 'urgent'] as Priority[]).map((p) => (
                <option key={p} value={p} className="capitalize">{p}</option>
              ))}
            </select>
            <DeleteButton
              variant="button"
              label="Delete"
              message={`Permanently delete ${selectedIds.size} task${selectedIds.size === 1 ? '' : 's'}? This cannot be undone.`}
              onConfirm={() => bulkDelete.mutate(Array.from(selectedIds))}
            />
          </div>
        )}

        <div className="mb-5 flex items-center gap-2 flex-wrap">
          <span className="text-sm text-slate-400 font-medium shrink-0">Filter</span>
          <div className="w-px h-4 bg-slate-200 shrink-0" />

          {/* Status */}
          <FilterSelect
            value={statusFilter}
            onChange={(v) => { setStatusFilter(v); setPage(1) }}
            label="Status"
            active={!!statusFilter}
            activeLabel={(list?.statuses ?? []).find((s) => s.id === statusFilter)?.name}
          >
            <option value="">All statuses</option>
            {(list?.statuses ?? []).map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </FilterSelect>

          {/* Priority */}
          <FilterSelect
            value={priorityFilter}
            onChange={(v) => { setPriorityFilter(v as Priority | ''); setPage(1) }}
            label="Priority"
            active={!!priorityFilter}
            activeLabel={priorityFilter || undefined}
          >
            <option value="">All priorities</option>
            {PRIORITIES.filter((p) => p !== 'none').map((p) => (
              <option key={p} value={p} className="capitalize">{p}</option>
            ))}
          </FilterSelect>

          {/* Custom fields */}
          {fieldDefs.map((field) => {
            const val = cfFilters[field.id] ?? ''
            const set = (v: string) => { setCfFilters((prev) => { const next = { ...prev }; if (v) next[field.id] = v; else delete next[field.id]; return next }); setPage(1) }
            if (field.field_type === 'dropdown' || field.field_type === 'checkbox') {
              return (
                <FilterSelect
                  key={field.id}
                  value={val}
                  onChange={set}
                  label={field.name}
                  active={!!val}
                  activeLabel={val === 'true' ? 'Yes' : val === 'false' ? 'No' : val}
                >
                  <option value="">All</option>
                  {field.field_type === 'checkbox' ? (
                    <>
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </>
                  ) : (
                    (field.options_json ?? []).map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))
                  )}
                </FilterSelect>
              )
            }
            return (
              <input
                key={field.id}
                type={field.field_type === 'number' ? 'number' : field.field_type === 'date' ? 'date' : 'text'}
                value={val}
                onChange={(e) => set(e.target.value)}
                placeholder={field.name}
                className={`h-8 border rounded-full px-3 text-xs focus:outline-none focus:ring-2 focus:ring-violet-500 w-32 transition-colors ${
                  val ? 'border-violet-400 bg-violet-50 text-violet-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              />
            )
          })}

          {(statusFilter || priorityFilter || Object.keys(cfFilters).length > 0) && (
            <button
              onClick={() => { setStatusFilter(''); setPriorityFilter(''); setCfFilters({}); setPage(1) }}
              className="h-8 flex items-center gap-1 text-xs text-slate-400 hover:text-red-500 transition-colors px-2 rounded-full hover:bg-red-50"
            >
              <span>✕</span> Clear
            </button>
          )}
        </div>

        {creating && (
          <form
            className="mb-4 flex gap-2"
            onSubmit={(e) => { e.preventDefault(); createTask.mutate(newTitle) }}
          >
            <input
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Task title"
              className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
            <button type="submit" className="bg-violet-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-violet-700 transition-colors">Create</button>
            <button type="button" onClick={() => setCreating(false)} className="text-sm px-3 py-2 text-slate-500 hover:text-slate-700 transition-colors">Cancel</button>
          </form>
        )}

        {isLoading ? (
          <p className="text-slate-400 text-sm">Loading...</p>
        ) : allTasks.length === 0 ? (
          <div className="text-center py-20 bg-white border border-dashed border-slate-200 rounded-2xl">
            <p className="text-slate-700 font-medium mb-1">No tasks yet</p>
            <p className="text-slate-400 text-sm mb-4">Create your first task to get started.</p>
            <button
              onClick={() => setCreating(true)}
              className="bg-violet-600 text-white text-sm px-5 py-2 rounded-lg hover:bg-violet-700 transition-colors font-medium"
            >+ New task</button>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden" id="task-table">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3.5 w-10">
                    <input
                      type="checkbox"
                      checked={allTasks.length > 0 && selectedIds.size === allTasks.length}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedIds(new Set(allTasks.map((t) => t.id)))
                        } else {
                          setSelectedIds(new Set())
                        }
                      }}
                      className="rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                    />
                  </th>
                  <th className="text-left px-4 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Title</th>
                  <th className="text-left px-4 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Priority</th>
                  <th className="text-left px-4 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Assignees</th>
                  <th className="text-left px-4 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Reviewer</th>
                  <th className="text-left px-4 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Due Date</th>
                  <th className="px-4 py-3.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedTasks.map((task: Task) => {
                  const isSubtask = !!task.parent_task_id
                  const parentTask = isSubtask ? taskMap[task.parent_task_id!] : null
                  return (
                  <tr key={task.id} className={`hover:bg-slate-50 transition-colors ${selectedIds.has(task.id) ? 'bg-violet-50' : ''} ${isSubtask ? 'bg-slate-50/60' : ''}`}>
                    <td className="px-4 py-3 w-10">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(task.id)}
                        onChange={(e) => {
                          const next = new Set(selectedIds)
                          if (e.target.checked) next.add(task.id)
                          else next.delete(task.id)
                          setSelectedIds(next)
                        }}
                        className="rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                      />
                    </td>
                    <td className={`px-4 py-3 ${isSubtask ? 'pl-10' : ''}`}>
                      {isSubtask && (
                        <div className="flex items-center gap-1 mb-0.5">
                          <span className="text-slate-300 text-xs">↳</span>
                          <button
                            onClick={() => navigate(`/tasks/${task.parent_task_id}`)}
                            className="text-xs text-slate-400 hover:text-violet-500 transition-colors truncate max-w-[180px]"
                          >
                            {parentTask?.title ?? 'Parent task'}
                          </button>
                        </div>
                      )}
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => navigate(`/tasks/${task.id}`)}
                          className={`text-left hover:text-violet-600 transition-colors ${isSubtask ? 'text-sm font-medium text-slate-700' : 'font-semibold text-slate-800 text-base'}`}
                        >
                          {task.title}
                        </button>
                        {depFlags[task.id]?.is_blocked && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-red-50 text-red-500 border border-red-200 shrink-0" title="Blocked by another task">
                            ⛔ Blocked
                          </span>
                        )}
                        {depFlags[task.id]?.is_blocking && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200 shrink-0" title="Blocking another task">
                            ⚠ Blocking
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {task.status_id && statusMap[task.status_id] ? (
                        <span
                          className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
                          style={{ backgroundColor: statusMap[task.status_id].color + '20', color: statusMap[task.status_id].color }}
                        >
                          {statusMap[task.status_id].name}
                        </span>
                      ) : (
                        <span className="text-slate-300 text-sm">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-2 text-sm font-medium capitalize text-slate-600">
                        <span
                          className="w-2.5 h-2.5 rounded-full inline-block shrink-0"
                          style={{ backgroundColor: PRIORITY_DOT_COLORS[task.priority] }}
                        />
                        {task.priority === 'none' ? '—' : task.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <AvatarStack ids={task.assignee_ids} memberMap={memberMap} />
                    </td>
                    <td className="px-4 py-3">
                      {task.reviewer_id && memberMap[task.reviewer_id] ? (
                        <Avatar member={memberMap[task.reviewer_id]} title="Reviewer" />
                      ) : (
                        <span className="text-slate-300 text-sm">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <DueDateBadge dueDate={task.due_date} statusComplete={task.status_id ? statusMap[task.status_id]?.is_complete : false} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <DeleteButton
                        variant="icon"
                        message={`Delete "${task.title}"? This cannot be undone.`}
                        onConfirm={() => deleteTask.mutate(task.id)}
                      />
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-slate-400">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, totalCount)} of {totalCount}
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

function DueDateBadge({ dueDate, statusComplete }: { dueDate: string | null; statusComplete: boolean | undefined }) {
  if (!dueDate) return <span className="text-slate-300 text-xs">—</span>

  // Compare date only (Asia/Taipei boundary)
  const today = new Date()
  const due = new Date(dueDate)
  const todayStr = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`
  const dueStr = `${due.getFullYear()}-${due.getMonth()}-${due.getDate()}`
  const isOverdue = !statusComplete && dueStr < todayStr
  const isDueToday = !statusComplete && dueStr === todayStr

  const label = due.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: due.getFullYear() !== today.getFullYear() ? 'numeric' : undefined })

  if (statusComplete) {
    return <span className="text-xs text-slate-400">{label}</span>
  }
  if (isOverdue) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
        <span>⚠</span> {label}
      </span>
    )
  }
  if (isDueToday) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
        Today
      </span>
    )
  }
  return <span className="text-xs text-slate-500">{label}</span>
}

function AvatarStack({ ids, memberMap }: { ids: string[]; memberMap: Record<string, Member> }) {
  if (ids.length === 0) return <span className="text-slate-300 text-xs">—</span>
  return (
    <div className="flex -space-x-1.5">
      {ids.slice(0, 4).map((id) =>
        memberMap[id] ? (
          <Avatar key={id} member={memberMap[id]} />
        ) : null
      )}
      {ids.length > 4 && (
        <span className="inline-flex w-7 h-7 rounded-full bg-slate-100 text-slate-500 text-xs font-semibold items-center justify-center border-2 border-white shadow-sm">
          +{ids.length - 4}
        </span>
      )}
    </div>
  )
}
