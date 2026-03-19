import { useState, useEffect, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { tasksApi, type Priority, type Task } from '@/api/tasks'
import { listsApi } from '@/api/lists'
import { projectsApi } from '@/api/projects'
import { useWorkspaceMembers, type Member } from '@/api/workspaces'
import ProjectHeader from '@/components/ProjectHeader'
import DeleteButton from '@/components/DeleteButton'
import FilterBar, { type FilterRule } from '@/components/FilterBar'
import { savedViewsApi } from '@/api/savedViews'
import { useEpics } from '@/api/epics'
import { useWorkspaceTags } from '@/api/tags'
import { toast } from '@/store/toastStore'

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
  const [sortBy, setSortBy] = useState<string | undefined>(undefined)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [groupBy, setGroupBy] = useState<GroupBy>('none')
  const [searchQuery, setSearchQuery] = useState('')
  const [hideCompleted, setHideCompleted] = useState(false)
  const [showViewsPanel, setShowViewsPanel] = useState(false)
  const [newViewName, setNewViewName] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Derive API params from filter rules
  const listEq = filterRules.find((r) => r.field === 'list' && r.op === 'eq')?.value
  const priorityEq = filterRules.find((r) => r.field === 'priority' && r.op === 'eq')?.value as Priority | undefined
  const priorityNots = filterRules.filter((r) => r.field === 'priority' && r.op === 'neq').map((r) => r.value)
  const tagFilterIds = filterRules.filter((r) => r.field === 'tag' && r.op === 'eq').map((r) => r.value)
  const statusNameEq = filterRules.find((r) => r.field === 'status_name' && r.op === 'eq')?.value
  const statusNameNots = filterRules.filter((r) => r.field === 'status_name' && r.op === 'neq').map((r) => r.value)

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

  const uniqueStatusNames = Array.from(
    new Map(
      listDetails.flatMap((l) => (l.statuses ?? []).map((s) => [s.name.toLowerCase(), s.name]))
    ).values()
  ).sort()

  const { data: epics = [] } = useEpics(projectId)
  const epicMap = Object.fromEntries(epics.map((e) => [e.id, e]))

  const { data: result, isLoading } = useQuery({
    queryKey: ['project-tasks', projectId, filterRules, includeSubtasks, page, sortBy, sortDir],
    queryFn: () => tasksApi.listForProject(projectId!, {
      page,
      page_size: PAGE_SIZE,
      list_id: listEq || undefined,
      priority: priorityEq || undefined,
      priority_not: priorityNots.join(',') || undefined,
      tag_ids: tagFilterIds.join(',') || undefined,
      status_name: statusNameEq || undefined,
      status_name_not: statusNameNots.join(',') || undefined,
      include_subtasks: includeSubtasks,
      sort_by: sortBy,
      sort_dir: sortDir,
    }),
    enabled: !!projectId,
  })

  const tasks = result?.items ?? []
  const total = result?.total ?? 0
  const totalPages = Math.ceil(total / PAGE_SIZE)

  const workspaceId = project?.workspace_id
  const { data: members = [] } = useWorkspaceMembers(workspaceId)
  const memberMap = Object.fromEntries(members.map((m) => [m.user_id, m]))

  const { data: workspaceTags = [] } = useWorkspaceTags(workspaceId)
  const tagMap = Object.fromEntries(workspaceTags.map((t) => [t.id, t]))


  const updateTask = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof tasksApi.update>[1] }) =>
      tasksApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project-tasks', projectId] }),
    onError: () => toast.error('Update failed'),
  })

  const bulkUpdate = useMutation({
    mutationFn: ({ taskIds, data }: { taskIds: string[]; data: { status_id?: string; priority?: string; epic_id?: string | null } }) =>
      tasksApi.bulkUpdate(taskIds, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-tasks', projectId] })
      setSelectedIds(new Set())
    },
    onError: () => toast.error('Bulk update failed'),
  })

  const bulkDelete = useMutation({
    mutationFn: (taskIds: string[]) => tasksApi.bulkDelete(taskIds),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-tasks', projectId] })
      setSelectedIds(new Set())
    },
    onError: () => toast.error('Bulk delete failed'),
  })

  const bulkMove = useMutation({
    mutationFn: ({ taskIds, targetListId }: { taskIds: string[]; targetListId: string }) =>
      tasksApi.bulkMove(taskIds, targetListId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-tasks', projectId] })
      setSelectedIds(new Set())
      toast.success('Tasks moved')
    },
    onError: () => toast.error('Move failed'),
  })

  // For bulk status: only valid when all selected tasks share the same list
  const selectedTasks = tasks.filter((t) => selectedIds.has(t.id))
  const selectedListIds = new Set(selectedTasks.map((t) => t.list_id).filter(Boolean))
  const singleSelectedListId = selectedListIds.size === 1 ? [...selectedListIds][0] : null
  const selectedListStatuses = singleSelectedListId
    ? (listDetails.find((l) => l.id === singleSelectedListId)?.statuses ?? [])
    : []

  const _taskVisible = (t: Task) => {
    if (hideCompleted && t.status_id && statusMap[t.status_id]?.is_complete) return false
    if (searchQuery && !t.title.toLowerCase().includes(searchQuery.toLowerCase())) return false
    return true
  }
  const visibleTasks = tasks.filter(_taskVisible)

  type DisplayGroup = { groupKey: string | null; groupLabel: string; groupColor: string; tasks: Task[]; showHeader: boolean }

  // Build display groups
  const displayGroups = ((): DisplayGroup[] => {
    if (groupBy === 'none') {
      return [{ groupKey: null, groupLabel: '', groupColor: '', tasks: visibleTasks, showHeader: false }]
    }

    if (groupBy === 'status') {
      // Collect unique status names in first-seen order, keeping first occurrence's color
      const seenNames = new Map<string, { name: string; color: string }>()
      for (const l of listDetails) {
        for (const s of (l.statuses ?? [])) {
          const key = s.name.toLowerCase()
          if (!seenNames.has(key)) seenNames.set(key, { name: s.name, color: s.color })
        }
      }
      const result: DisplayGroup[] = []
      for (const [, { name, color }] of seenNames) {
        const groupTasks = visibleTasks.filter((t) => {
          const statusName = t.status_id ? statusMap[t.status_id]?.name : undefined
          return statusName?.toLowerCase() === name.toLowerCase()
        })
        if (groupTasks.length === 0) continue
        result.push({ groupKey: name, groupLabel: name, groupColor: color, tasks: groupTasks, showHeader: true })
      }
      const noStatus = visibleTasks.filter((t) => !t.status_id)
      if (noStatus.length > 0) {
        result.push({ groupKey: null, groupLabel: 'No Status', groupColor: '#cbd5e1', tasks: noStatus, showHeader: true })
      }
      return result
    }

    if (groupBy === 'assignee') {
      const seenIds = new Set<string>()
      visibleTasks.forEach((t) => t.assignee_ids.forEach((id) => seenIds.add(id)))
      const result: DisplayGroup[] = []
      for (const uid of seenIds) {
        const groupTasks = visibleTasks.filter((t) => t.assignee_ids.includes(uid))
        if (groupTasks.length === 0) continue
        result.push({
          groupKey: uid,
          groupLabel: memberMap[uid]?.display_name ?? 'Unknown',
          groupColor: '#a78bfa',
          tasks: groupTasks,
          showHeader: true,
        })
      }
      const unassigned = visibleTasks.filter((t) => t.assignee_ids.length === 0)
      if (unassigned.length > 0) {
        result.push({ groupKey: null, groupLabel: 'Unassigned', groupColor: '#cbd5e1', tasks: unassigned, showHeader: true })
      }
      return result
    }

    if (groupBy === 'priority') {
      const PRIORITY_ORDER: Priority[] = ['urgent', 'high', 'medium', 'low', 'none']
      const result: DisplayGroup[] = []
      for (const p of PRIORITY_ORDER) {
        const groupTasks = visibleTasks.filter((t) => t.priority === p)
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

    return [{ groupKey: null, groupLabel: '', groupColor: '', tasks: visibleTasks, showHeader: false }]
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

  const setDefaultView = useMutation({
    mutationFn: savedViewsApi.setDefault,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['saved-views', 'project', projectId] }),
  })

  const defaultApplied = useRef(false)
  useEffect(() => {
    if (defaultApplied.current || savedViews.length === 0) return
    const defaultView = savedViews.find((v) => v.is_default)
    if (defaultView) {
      setFilterRules(defaultView.filters_json.filter_rules ?? [])
      setGroupBy((defaultView.filters_json.group_by as GroupBy) ?? 'none')
      setPage(1)
    }
    defaultApplied.current = true
  }, [savedViews])

  function applyView(view: (typeof savedViews)[0]) {
    setFilterRules(view.filters_json.filter_rules ?? [])
    setGroupBy((view.filters_json.group_by as GroupBy) ?? 'none')
    setPage(1)
    setShowViewsPanel(false)
  }

  const hasFilters = filterRules.length > 0
  function resetPage() { setPage(1) }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <ProjectHeader projectId={projectId!} activeTab="tasks" />


      <main className="max-w-5xl mx-auto py-8 sm:py-10 px-4 sm:px-6">
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{project?.name}</h2>
            <p className="text-sm text-slate-400 dark:text-slate-500 mt-0.5">
              {total} task{total !== 1 ? 's' : ''}
              {totalPages > 1 && <span> · page {page} of {totalPages}</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                toast.info('Preparing export…')
                const params: Record<string, string | undefined> = {
                  list_id: listEq || undefined,
                  priority: priorityEq || undefined,
                  priority_not: priorityNots.join(',') || undefined,
                  include_subtasks: 'true',
                }
                await tasksApi.exportCsvForProject(projectId!, params)
              }}
              className="border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-sm px-4 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors font-medium flex items-center gap-1.5"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Export CSV
            </button>
            {/* Group by selector */}
            <div className="relative">
              <select
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value as GroupBy)}
                className={`h-9 appearance-none pl-3 pr-7 rounded-lg text-sm font-medium border cursor-pointer focus:outline-none focus:ring-2 focus:ring-violet-500 transition-colors ${
                  groupBy !== 'none'
                    ? 'border-violet-300 bg-violet-50 dark:bg-violet-950 text-violet-700 dark:text-violet-300'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <option value="none">Group by…</option>
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
                    ? 'bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300 border-violet-300 dark:border-violet-700'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                </svg>
                Views
                {savedViews.length > 0 && (
                  <span className="text-[11px] bg-violet-100 text-violet-600 px-1.5 rounded-full font-semibold">
                    {savedViews.length}
                  </span>
                )}
              </button>
              {showViewsPanel && (
                <div className="absolute right-0 mt-1 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg w-72 p-3 space-y-1.5">
                  {savedViews.length === 0 && (
                    <p className="text-xs text-slate-400 dark:text-slate-500 px-1 pb-1">No saved views yet.</p>
                  )}
                  {savedViews.map((v) => (
                    <div key={v.id} className="flex items-center gap-1.5 group">
                      <button
                        onClick={() => applyView(v)}
                        className="flex-1 text-left text-sm text-slate-700 dark:text-slate-300 hover:text-violet-600 dark:hover:text-violet-400 font-medium truncate py-1"
                      >
                        {v.name}
                      </button>
                      <button
                        onClick={() => setDefaultView.mutate(v.id)}
                        title={v.is_default ? 'Remove default' : 'Set as default'}
                        className={`shrink-0 transition-all active:scale-90 ${v.is_default ? 'text-amber-400' : 'text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 hover:text-amber-400'}`}
                        aria-label={v.is_default ? `Remove default for ${v.name}` : `Set ${v.name} as default`}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill={v.is_default ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                        </svg>
                      </button>
                      <button
                        onClick={() => deleteView.mutate(v.id)}
                        className="shrink-0 text-slate-300 dark:text-slate-600 hover:text-red-500 text-xs opacity-0 group-hover:opacity-100 transition-all"
                        aria-label={`Delete view ${v.name}`}
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                      </button>
                    </div>
                  ))}
                  <div className="border-t border-slate-100 dark:border-slate-800 pt-2 flex gap-2">
                    <input
                      value={newViewName}
                      onChange={(e) => setNewViewName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && newViewName.trim()) createView.mutate(newViewName.trim()) }}
                      placeholder="View name…"
                      className="flex-1 text-xs border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 dark:placeholder-slate-500"
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
              ...(uniqueStatusNames.length > 0 ? [{
                id: 'status_name',
                label: 'Status',
                options: uniqueStatusNames.map((n) => ({ value: n, label: n })),
              }] : []),
              {
                id: 'priority',
                label: 'Priority',
                options: PRIORITIES.filter((p) => p !== 'none').map((p) => ({
                  value: p,
                  label: p.charAt(0).toUpperCase() + p.slice(1),
                })),
              },
              ...(workspaceTags.length > 0 ? [{
                id: 'tag',
                label: 'Tag',
                ops: ['eq'] as ['eq'],
                options: workspaceTags.map((t) => ({ value: t.id, label: t.name })),
              }] : []),
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

        {/* Bulk action bar */}
        {selectedIds.size > 0 && (
          <div className="mb-4 flex items-center gap-3 bg-violet-50 dark:bg-violet-950 border border-violet-200 dark:border-violet-800 rounded-xl px-4 py-2.5">
            <span className="text-xs font-semibold text-violet-700 dark:text-violet-300">{selectedIds.size} selected</span>
            <div className="w-px h-4 bg-violet-200 dark:bg-violet-800" />
            {singleSelectedListId && (
              <select
                className="h-7 text-xs border border-violet-300 dark:border-violet-700 rounded-md px-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-500"
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) {
                    bulkUpdate.mutate({ taskIds: Array.from(selectedIds), data: { status_id: e.target.value } })
                    e.target.value = ''
                  }
                }}
              >
                <option value="" disabled>Set status…</option>
                {selectedListStatuses.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            )}
            <select
              className="h-7 text-xs border border-violet-300 dark:border-violet-700 rounded-md px-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-500"
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
            <select
              className="h-7 text-xs border border-violet-300 dark:border-violet-700 rounded-md px-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-500"
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) {
                  bulkMove.mutate({ taskIds: Array.from(selectedIds), targetListId: e.target.value })
                  e.target.value = ''
                }
              }}
            >
              <option value="" disabled>Move to list…</option>
              {lists.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
            {epics.length > 0 && (
              <select
                className="h-7 text-xs border border-violet-300 dark:border-violet-700 rounded-md px-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-500"
                defaultValue=""
                onChange={(e) => {
                  bulkUpdate.mutate({ taskIds: Array.from(selectedIds), data: { epic_id: e.target.value || null } })
                  e.target.value = ''
                }}
              >
                <option value="" disabled>Set epic…</option>
                <option value="">No epic</option>
                {epics.map((e) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            )}
            <DeleteButton
              variant="button"
              label="Delete"
              message={`Permanently delete ${selectedIds.size} task${selectedIds.size === 1 ? '' : 's'}? This cannot be undone.`}
              onConfirm={() => bulkDelete.mutate(Array.from(selectedIds))}
            />
          </div>
        )}

        {/* Search + hide-completed toolbar */}
        <div className="flex items-center gap-2 mb-3">
          <div className="relative flex-1 max-w-xs">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tasks…"
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            )}
          </div>
          <button
            onClick={() => setHideCompleted((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              hideCompleted
                ? 'bg-violet-50 dark:bg-violet-950 border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
            }`}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            Hide completed
          </button>
          {(searchQuery || hideCompleted) && (
            <span className="text-xs text-slate-400 dark:text-slate-500">
              {visibleTasks.length} of {tasks.length}
            </span>
          )}
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden">
            <div className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 h-12" />
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-3.5">
                  <div className="w-4 h-4 rounded bg-slate-200 dark:bg-slate-700 animate-pulse shrink-0" />
                  <div className="flex-1 h-4 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" />
                  <div className="w-16 h-5 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse" />
                  <div className="w-20 h-5 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse" />
                  <div className="w-16 h-4 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" />
                  <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse" />
                  <div className="w-16 h-4 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" />
                  <div className="w-12 h-4 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-20 bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
            <p className="text-slate-700 dark:text-slate-300 font-medium mb-1">No tasks found</p>
            <p className="text-slate-400 dark:text-slate-500 text-sm">
              {hasFilters ? 'Try adjusting your filters.' : 'Tasks in this project will appear here.'}
            </p>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="w-10 px-4 py-3.5">
                    <input
                      type="checkbox"
                      className="w-3.5 h-3.5 rounded border-slate-300 text-violet-600"
                      checked={visibleTasks.length > 0 && visibleTasks.every((t) => selectedIds.has(t.id))}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedIds(new Set(visibleTasks.map((t) => t.id)))
                        else setSelectedIds(new Set())
                      }}
                    />
                  </th>
                  <SortTh col="title" label="Title" sortBy={sortBy} sortDir={sortDir} onSort={(c, d) => { setSortBy(c); setSortDir(d); setPage(1) }} />
                  <th className="text-left px-4 py-3.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">List</th>
                  <th className="text-left px-4 py-3.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
                  <SortTh col="priority" label="Priority" sortBy={sortBy} sortDir={sortDir} onSort={(c, d) => { setSortBy(c); setSortDir(d); setPage(1) }} />
                  <th className="text-left px-4 py-3.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Assignees</th>
                  <th className="text-left px-4 py-3.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Reviewer</th>
                  <SortTh col="due_date" label="Due Date" sortBy={sortBy} sortDir={sortDir} onSort={(c, d) => { setSortBy(c); setSortDir(d); setPage(1) }} />
                  <th className="text-left px-4 py-3.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Epic</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {displayGroups.flatMap(({ groupKey, groupLabel, groupColor, tasks: groupTasks, showHeader }) => {
                  const rows = []
                  if (showHeader) {
                    rows.push(
                      <tr key={`hdr-${groupKey ?? 'none'}`} className="bg-slate-50/80 dark:bg-slate-800/80">
                        <td colSpan={9} className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full inline-block shrink-0" style={{ backgroundColor: groupColor }} />
                            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{groupLabel}</span>
                            <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 bg-slate-200/60 dark:bg-slate-700/60 px-1.5 py-0.5 rounded-full">{groupTasks.length}</span>
                          </div>
                        </td>
                      </tr>
                    )
                  }
                  groupTasks.forEach((task: Task) => {
                    const list = task.list_id ? listMap[task.list_id] : null
                    const status = task.status_id ? statusMap[task.status_id] : null
                    rows.push(
                      <tr key={task.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${selectedIds.has(task.id) ? 'bg-violet-50/50 dark:bg-violet-950/30' : ''} ${status?.is_complete ? 'opacity-60' : ''}`}>
                        <td className="w-10 px-4 py-3">
                          <input
                            type="checkbox"
                            className="w-3.5 h-3.5 rounded border-slate-300 text-violet-600"
                            checked={selectedIds.has(task.id)}
                            onChange={(e) => {
                              const next = new Set(selectedIds)
                              if (e.target.checked) next.add(task.id)
                              else next.delete(task.id)
                              setSelectedIds(next)
                            }}
                          />
                        </td>
                        {/* Title */}
                        <td className={`px-4 py-3 ${task.parent_task_id ? 'pl-10' : ''}`}>
                          {task.parent_task_id && (
                            <div className="text-slate-300 dark:text-slate-600 mb-0.5">
                              <svg aria-hidden="true" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="15 10 20 15 15 20"/><path d="M4 4v7a4 4 0 0 0 4 4h12"/>
                              </svg>
                            </div>
                          )}
                          {task.task_key && (
                            <span className="text-[11px] font-mono font-semibold text-slate-400 dark:text-slate-500 block mb-0.5">
                              {task.task_key}
                            </span>
                          )}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <button
                              onClick={() => navigate(`/tasks/${task.id}`)}
                              className={`text-left font-semibold text-slate-800 dark:text-slate-200 hover:text-violet-600 dark:hover:text-violet-400 transition-colors ${status?.is_complete ? 'line-through' : ''}`}
                            >
                              {task.title}
                            </button>
                            {task.tag_ids?.map((tagId) => {
                              const tag = tagMap[tagId]
                              if (!tag) return null
                              return (
                                <span
                                  key={tagId}
                                  className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold text-white shrink-0"
                                  style={{ background: tag.color }}
                                >
                                  {tag.name}
                                </span>
                              )
                            })}
                          </div>
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
                            <span className="text-slate-300 dark:text-slate-600 text-sm">—</span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3">
                          <div className="relative inline-flex items-center cursor-pointer hover:ring-2 hover:ring-violet-300 dark:hover:ring-violet-700 rounded-lg transition-all">
                            {status ? (
                              <span
                                className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full pointer-events-none transition-colors duration-150"
                                style={{ backgroundColor: status.color + '20', color: status.color }}
                              >
                                {status.name}
                              </span>
                            ) : (
                              <span className="text-slate-300 dark:text-slate-600 text-sm px-2.5 py-1 pointer-events-none">—</span>
                            )}
                            <select
                              value={task.status_id ?? ''}
                              onChange={(e) => updateTask.mutate({ id: task.id, data: { status_id: e.target.value || null } })}
                              className="absolute inset-0 opacity-0 cursor-pointer w-full"
                            >
                              <option value="">No Status</option>
                              {(listDetails.find((l) => l.id === task.list_id)?.statuses ?? []).map((s) => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                              ))}
                            </select>
                          </div>
                        </td>

                        {/* Priority */}
                        <td className="px-4 py-3">
                          <div className="relative inline-flex items-center cursor-pointer hover:ring-2 hover:ring-violet-300 dark:hover:ring-violet-700 rounded-lg transition-all">
                            <span className="flex items-center gap-2 text-sm font-medium capitalize pointer-events-none">
                              <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0" style={{ backgroundColor: PRIORITY_DOT_COLORS[task.priority] }} />
                              <span className="text-slate-600 dark:text-slate-400">{task.priority === 'none' ? '—' : task.priority}</span>
                            </span>
                            <select
                              value={task.priority}
                              onChange={(e) => updateTask.mutate({ id: task.id, data: { priority: e.target.value as Priority } })}
                              className="absolute inset-0 opacity-0 cursor-pointer w-full"
                            >
                              {PRIORITIES.map((p) => (
                                <option key={p} value={p}>{p === 'none' ? '— None' : p}</option>
                              ))}
                            </select>
                          </div>
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
                          <div className="relative inline-flex items-center cursor-pointer hover:ring-2 hover:ring-violet-300 dark:hover:ring-violet-700 rounded-lg transition-all">
                            <span className="pointer-events-none">
                              <DueDateBadge dueDate={task.due_date} statusComplete={status?.is_complete} />
                            </span>
                            <input
                              type="date"
                              value={task.due_date ? task.due_date.slice(0, 10) : ''}
                              onChange={(e) => updateTask.mutate({ id: task.id, data: { due_date: e.target.value || null } })}
                              className="absolute inset-0 opacity-0 cursor-pointer w-full"
                            />
                          </div>
                        </td>

                        {/* Epic */}
                        <td className="px-4 py-3">
                          <div className="relative inline-flex items-center min-w-[80px] cursor-pointer hover:ring-2 hover:ring-violet-300 dark:hover:ring-violet-700 rounded-lg transition-all">
                            {task.epic_id && epicMap[task.epic_id] ? (
                              <span className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 pointer-events-none">
                                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: epicMap[task.epic_id].color }} />
                                <span className="truncate max-w-[100px]">{epicMap[task.epic_id].name}</span>
                              </span>
                            ) : (
                              <span className="text-slate-300 dark:text-slate-600 text-sm pointer-events-none">—</span>
                            )}
                            <select
                              value={task.epic_id ?? ''}
                              onChange={(e) => updateTask.mutate({ id: task.id, data: { epic_id: e.target.value || null } })}
                              className="absolute inset-0 opacity-0 cursor-pointer w-full"
                              aria-label="Set epic"
                            >
                              <option value="">No epic</option>
                              {epics.map((e) => (
                                <option key={e.id} value={e.id}>{e.name}</option>
                              ))}
                            </select>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                  return rows
                })}
              </tbody>
            </table>
            </div>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-slate-400 dark:text-slate-500">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-sm border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    {p}
                  </button>
                )
              })}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 text-sm border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
      className="inline-flex w-7 h-7 rounded-full bg-violet-100 text-violet-700 text-xs font-semibold items-center justify-center border-2 border-white dark:border-slate-900 shadow-sm select-none"
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

  // Compare date only (Asia/Taipei boundary). Month is padded to ensure correct lexicographic sort.
  const today = new Date()
  const due = new Date(dueDate)
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const todayStr = fmt(today)
  const dueStr = fmt(due)
  const isOverdue = !statusComplete && dueStr < todayStr
  const isDueToday = !statusComplete && dueStr === todayStr

  const label = due.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: due.getFullYear() !== today.getFullYear() ? 'numeric' : undefined })

  if (statusComplete) {
    return <span className="text-xs text-slate-400 dark:text-slate-500">{label}</span>
  }
  if (isOverdue) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        {label}
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



function SortTh({
  col, label, sortBy, sortDir, onSort,
}: {
  col: string
  label: string
  sortBy: string | undefined
  sortDir: 'asc' | 'desc'
  onSort: (col: string, dir: 'asc' | 'desc') => void
}) {
  const active = sortBy === col
  const next = active && sortDir === 'asc' ? 'desc' : 'asc'
  return (
    <th
      className="text-left px-4 py-3.5 text-xs font-semibold uppercase tracking-wider cursor-pointer select-none group"
      onClick={() => onSort(col, next)}
    >
      <span className={`flex items-center gap-1 ${active ? 'text-violet-600 dark:text-violet-400' : 'text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200'}`}>
        {label}
        <span className={`transition-opacity ${active ? 'opacity-100' : 'opacity-0 group-hover:opacity-40'}`}>
          {active && sortDir === 'desc' ? '↓' : '↑'}
        </span>
      </span>
    </th>
  )
}
