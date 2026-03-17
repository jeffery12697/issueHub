import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { tasksApi, type Priority, type Task } from '@/api/tasks'
import { listsApi } from '@/api/lists'
import { projectsApi } from '@/api/projects'
import { useWorkspaceMembers, workspacesApi, type Member } from '@/api/workspaces'
import HeaderActions from '@/components/HeaderActions'
import FilterBar, { type FilterRule } from '@/components/FilterBar'
import { savedViewsApi } from '@/api/savedViews'
import { useUIStore } from '@/store/uiStore'

type GroupBy = 'none' | 'status' | 'assignee' | 'priority'

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
  const qc = useQueryClient()

  const [filterRules, setFilterRules] = useState<FilterRule[]>([])
  const [includeSubtasks, setIncludeSubtasks] = useState(false)
  const [page, setPage] = useState(1)
  const [groupBy, setGroupBy] = useState<GroupBy>('none')
  const [showViewsPanel, setShowViewsPanel] = useState(false)
  const [newViewName, setNewViewName] = useState('')

  // Derive API params from filter rules
  const listEq = filterRules.find((r) => r.field === 'list' && r.op === 'eq')?.value
  const priorityEq = filterRules.find((r) => r.field === 'priority' && r.op === 'eq')?.value as Priority | undefined
  const priorityNots = filterRules.filter((r) => r.field === 'priority' && r.op === 'neq').map((r) => r.value)

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
    queryKey: ['project-tasks', projectId, filterRules, includeSubtasks, page],
    queryFn: () => tasksApi.listForProject(projectId!, {
      page,
      page_size: PAGE_SIZE,
      list_id: listEq || undefined,
      priority: priorityEq || undefined,
      priority_not: priorityNots.join(',') || undefined,
      include_subtasks: includeSubtasks,
    }),
    enabled: !!projectId,
  })

  const tasks = result?.items ?? []
  const total = result?.total ?? 0
  const totalPages = Math.ceil(total / PAGE_SIZE)

  const workspaceId = project?.workspace_id
  const setWorkspaceId = useUIStore((s) => s.setWorkspaceId)
  useEffect(() => { if (workspaceId) setWorkspaceId(workspaceId) }, [workspaceId])
  const { data: workspace } = useQuery({
    queryKey: ['workspace', workspaceId],
    queryFn: () => workspacesApi.get(workspaceId!),
    enabled: !!workspaceId,
  })
  const { data: members = [] } = useWorkspaceMembers(workspaceId)
  const memberMap = Object.fromEntries(members.map((m) => [m.user_id, m]))

  type DisplayGroup = { groupKey: string | null; groupLabel: string; groupColor: string; tasks: Task[]; showHeader: boolean }

  // Build display groups
  const displayGroups = ((): DisplayGroup[] => {
    if (groupBy === 'none') {
      return [{ groupKey: null, groupLabel: '', groupColor: '', tasks, showHeader: false }]
    }

    if (groupBy === 'status') {
      const seenIds = new Set<string>()
      const orderedStatuses: Array<{ id: string; name: string; color: string }> = []
      for (const l of listDetails) {
        for (const s of (l.statuses ?? [])) {
          if (!seenIds.has(s.id)) { seenIds.add(s.id); orderedStatuses.push(s) }
        }
      }
      const result: DisplayGroup[] = []
      for (const s of orderedStatuses) {
        const groupTasks = tasks.filter((t) => t.status_id === s.id)
        if (groupTasks.length === 0) continue
        result.push({ groupKey: s.id, groupLabel: s.name, groupColor: s.color, tasks: groupTasks, showHeader: true })
      }
      const noStatus = tasks.filter((t) => !t.status_id)
      if (noStatus.length > 0) {
        result.push({ groupKey: null, groupLabel: 'No Status', groupColor: '#cbd5e1', tasks: noStatus, showHeader: true })
      }
      return result
    }

    if (groupBy === 'assignee') {
      const seenIds = new Set<string>()
      tasks.forEach((t) => t.assignee_ids.forEach((id) => seenIds.add(id)))
      const result: DisplayGroup[] = []
      for (const uid of seenIds) {
        const groupTasks = tasks.filter((t) => t.assignee_ids.includes(uid))
        if (groupTasks.length === 0) continue
        result.push({
          groupKey: uid,
          groupLabel: memberMap[uid]?.display_name ?? 'Unknown',
          groupColor: '#a78bfa',
          tasks: groupTasks,
          showHeader: true,
        })
      }
      const unassigned = tasks.filter((t) => t.assignee_ids.length === 0)
      if (unassigned.length > 0) {
        result.push({ groupKey: null, groupLabel: 'Unassigned', groupColor: '#cbd5e1', tasks: unassigned, showHeader: true })
      }
      return result
    }

    if (groupBy === 'priority') {
      const PRIORITY_ORDER: Priority[] = ['urgent', 'high', 'medium', 'low', 'none']
      const result: DisplayGroup[] = []
      for (const p of PRIORITY_ORDER) {
        const groupTasks = tasks.filter((t) => t.priority === p)
        if (groupTasks.length === 0) continue
        result.push({
          groupKey: p,
          groupLabel: p === 'none' ? 'No Priority' : p.charAt(0).toUpperCase() + p.slice(1),
          groupColor: PRIORITY_DOT_COLORS[p],
          tasks: groupTasks,
          showHeader: true,
        })
      }
      return result
    }

    return [{ groupKey: null, groupLabel: '', groupColor: '', tasks, showHeader: false }]
  })()

  const { data: savedViews = [] } = useQuery({
    queryKey: ['saved-views', 'project', projectId],
    queryFn: () => savedViewsApi.listForProject(projectId!),
    enabled: !!projectId,
  })

  const createView = useMutation({
    mutationFn: (name: string) =>
      savedViewsApi.createForProject(projectId!, name, {
        filter_rules: filterRules,
        cf_filters: {},
        group_by: groupBy,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['saved-views', 'project', projectId] })
      setNewViewName('')
    },
  })

  const deleteView = useMutation({
    mutationFn: savedViewsApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['saved-views', 'project', projectId] }),
  })

  function applyView(view: (typeof savedViews)[0]) {
    setFilterRules(view.filters_json.filter_rules ?? [])
    setGroupBy((view.filters_json.group_by as GroupBy) ?? 'none')
    setPage(1)
    setShowViewsPanel(false)
  }

  const hasFilters = filterRules.length > 0
  function resetPage() { setPage(1) }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 h-16 flex items-center gap-4">
        <Link to="/" className="text-slate-400 hover:text-slate-600 text-sm transition-colors shrink-0">← Home</Link>
        {workspace && (
          <>
            <span className="text-slate-200 shrink-0">/</span>
            <Link
              to={`/workspaces/${workspace.id}`}
              className="text-xs font-medium text-slate-500 hover:text-violet-600 bg-slate-100 hover:bg-violet-50 px-2 py-0.5 rounded-md truncate max-w-[140px] transition-colors"
            >
              {workspace.name}
            </Link>
          </>
        )}
        <span className="text-slate-200 shrink-0">/</span>
        <span className="text-sm font-semibold text-slate-800 truncate max-w-[160px]">{project?.name}</span>
        <nav className="flex items-center gap-1 ml-2">
          <Link
            to={`/projects/${projectId}`}
            className="px-3.5 py-2 rounded-lg text-sm font-medium transition-colors bg-violet-50 text-violet-700"
          >
            All Tasks
          </Link>
          <Link
            to={`/projects/${projectId}/analytics`}
            className="px-3.5 py-2 rounded-lg text-sm font-medium transition-colors text-slate-500 hover:text-slate-700 hover:bg-slate-50"
          >
            Analytics
          </Link>
        </nav>
        <div className="ml-auto">
          <HeaderActions />
        </div>
      </header>

      <main className="max-w-5xl mx-auto py-8 px-6">
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{project?.name}</h2>
            <p className="text-sm text-slate-400 mt-0.5">
              {total} task{total !== 1 ? 's' : ''}
              {totalPages > 1 && <span> · page {page} of {totalPages}</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Group by selector */}
            <div className="relative">
              <select
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value as GroupBy)}
                className={`h-9 appearance-none pl-3 pr-7 rounded-lg text-sm font-medium border cursor-pointer focus:outline-none focus:ring-2 focus:ring-violet-500 transition-colors ${
                  groupBy !== 'none'
                    ? 'border-violet-300 bg-violet-50 text-violet-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <option value="none">⊞ Group by…</option>
                <option value="status">Status</option>
                <option value="assignee">Assignee</option>
                <option value="priority">Priority</option>
              </select>
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] opacity-50">▾</span>
            </div>
            {/* Saved views */}
            <div className="relative">
              <button
                onClick={() => setShowViewsPanel((v) => !v)}
                className={`border text-sm px-3 py-2 rounded-lg transition-colors font-medium flex items-center gap-1.5 ${
                  showViewsPanel
                    ? 'bg-violet-100 text-violet-700 border-violet-300'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                📋 Views
                {savedViews.length > 0 && (
                  <span className="text-[11px] bg-violet-100 text-violet-600 px-1.5 rounded-full font-semibold">
                    {savedViews.length}
                  </span>
                )}
              </button>
              {showViewsPanel && (
                <div className="absolute right-0 mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-lg w-72 p-3 space-y-1.5">
                  {savedViews.length === 0 && (
                    <p className="text-xs text-slate-400 px-1 pb-1">No saved views yet.</p>
                  )}
                  {savedViews.map((v) => (
                    <div key={v.id} className="flex items-center gap-2 group">
                      <button
                        onClick={() => applyView(v)}
                        className="flex-1 text-left text-sm text-slate-700 hover:text-violet-600 font-medium truncate py-1"
                      >
                        {v.name}
                      </button>
                      <button
                        onClick={() => deleteView.mutate(v.id)}
                        className="text-slate-300 hover:text-red-500 text-xs opacity-0 group-hover:opacity-100 transition-all"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <div className="border-t border-slate-100 pt-2 flex gap-2">
                    <input
                      value={newViewName}
                      onChange={(e) => setNewViewName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && newViewName.trim()) createView.mutate(newViewName.trim()) }}
                      placeholder="View name…"
                      className="flex-1 text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                    <button
                      onClick={() => { if (newViewName.trim()) createView.mutate(newViewName.trim()) }}
                      disabled={!newViewName.trim()}
                      className="text-xs bg-violet-600 text-white px-3 py-1.5 rounded-lg hover:bg-violet-700 disabled:opacity-40 transition-colors"
                    >
                      Save
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Filter bar */}
        <div className="mb-5 space-y-2">
          <FilterBar
            fields={[
              {
                id: 'list',
                label: 'List',
                options: lists.map((l) => ({ value: l.id, label: l.name })),
                ops: ['eq'],
              },
              {
                id: 'priority',
                label: 'Priority',
                options: PRIORITIES.filter((p) => p !== 'none').map((p) => ({
                  value: p,
                  label: p.charAt(0).toUpperCase() + p.slice(1),
                })),
              },
            ]}
            rules={filterRules}
            onRulesChange={(rules, reset) => { setFilterRules(rules); if (reset) resetPage() }}
            extra={
              <label className="flex items-center gap-2 text-sm text-slate-500 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeSubtasks}
                  onChange={(e) => { setIncludeSubtasks(e.target.checked); resetPage() }}
                  className="w-3.5 h-3.5 rounded border-slate-300 text-violet-600"
                />
                Subtasks
              </label>
            }
          />
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
                {displayGroups.flatMap(({ groupKey, groupLabel, groupColor, tasks: groupTasks, showHeader }) => {
                  const rows = []
                  if (showHeader) {
                    rows.push(
                      <tr key={`hdr-${groupKey ?? 'none'}`} className="bg-slate-50/80">
                        <td colSpan={7} className="px-4 py-2.5 border-b border-slate-100">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full inline-block shrink-0" style={{ backgroundColor: groupColor }} />
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{groupLabel}</span>
                            <span className="text-[11px] font-medium text-slate-400 bg-slate-200/60 px-1.5 py-0.5 rounded-full">{groupTasks.length}</span>
                          </div>
                        </td>
                      </tr>
                    )
                  }
                  groupTasks.forEach((task: Task) => {
                    const list = task.list_id ? listMap[task.list_id] : null
                    const status = task.status_id ? statusMap[task.status_id] : null
                    rows.push(
                      <tr key={task.id} className="hover:bg-slate-50 transition-colors">
                        {/* Title */}
                        <td className={`px-4 py-3 ${task.parent_task_id ? 'pl-10' : ''}`}>
                          {task.parent_task_id && (
                            <div className="text-xs text-slate-300 mb-0.5">↳</div>
                          )}
                          {task.task_key && (
                            <span className="text-[11px] font-mono font-semibold text-slate-400 block mb-0.5">
                              {task.task_key}
                            </span>
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
                  })
                  return rows
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

