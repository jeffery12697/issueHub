import { useState, useEffect, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { projectsApi } from '@/api/projects'
import { workspacesApi } from '@/api/workspaces'
import { epicsApi, useEpicTasks, useUpdateEpic, useDeleteEpic, type EpicStatus } from '@/api/epics'
import { tasksApi, type Task, type Priority } from '@/api/tasks'
import { listsApi } from '@/api/lists'
import { useWorkspaceMembers } from '@/api/workspaces'
import HeaderActions from '@/components/HeaderActions'
import DeleteButton from '@/components/DeleteButton'
import { PRIORITY_DOT_COLORS } from '@/lib/priority'
import { toast } from '@/store/toastStore'
import { useUIStore } from '@/store/uiStore'

const DEFAULT_COLORS = ['#8b5cf6', '#38bdf8', '#34d399', '#fbbf24', '#fb7185', '#818cf8']

const STATUS_LABELS: Record<EpicStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  done: 'Done',
}

const STATUS_COLORS: Record<EpicStatus, string> = {
  not_started: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
  in_progress: 'bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400',
  done: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400',
}

function progressPercent(done: number, total: number) {
  if (total === 0) return 0
  return Math.round((done / total) * 100)
}

function DueDateBadge({ dueDate, complete }: { dueDate: string | null; complete: boolean }) {
  if (!dueDate) return <span className="text-slate-300 dark:text-slate-600 text-sm">—</span>
  const today = new Date()
  const due = new Date(dueDate)
  const overdue = !complete && due < today
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${overdue ? 'bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
      {due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
    </span>
  )
}

export default function EpicDetailPage() {
  const { projectId, epicId } = useParams<{ projectId: string; epicId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.get(projectId!),
    enabled: !!projectId,
  })

  const workspaceId = project?.workspace_id
  const setWorkspaceId = useUIStore((s) => s.setWorkspaceId)
  useEffect(() => { if (workspaceId) setWorkspaceId(workspaceId) }, [workspaceId])

  const { data: workspace } = useQuery({
    queryKey: ['workspace', workspaceId],
    queryFn: () => workspacesApi.get(workspaceId!),
    enabled: !!workspaceId,
  })

  const { data: epic, isLoading: epicLoading } = useQuery({
    queryKey: ['epic', epicId],
    queryFn: () => epicsApi.get(epicId!),
    enabled: !!epicId,
  })

  const { data: epicTasks = [], isLoading: tasksLoading } = useEpicTasks(epicId)

  // All project tasks for "add tasks" search
  const { data: allTasksResult } = useQuery({
    queryKey: ['project-tasks-for-epic', projectId],
    queryFn: () => tasksApi.listForProject(projectId!, { page: 1, page_size: 500 }),
    enabled: !!projectId,
  })
  const allProjectTasks = allTasksResult?.items ?? []

  // Lists + statuses for task rows
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

  const { data: members = [] } = useWorkspaceMembers(workspaceId)
  const memberMap = Object.fromEntries(members.map((m) => [m.user_id, m]))

  const updateEpic = useUpdateEpic(projectId!)
  const deleteEpic = useDeleteEpic(projectId!)

  const updateTask = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof tasksApi.update>[1] }) =>
      tasksApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['epic-tasks', epicId] })
      qc.invalidateQueries({ queryKey: ['epic', epicId] })
    },
    onError: () => toast.error('Update failed'),
  })

  // Edit states
  const [editingName, setEditingName] = useState(false)
  const [nameVal, setNameVal] = useState('')
  const [editingDesc, setEditingDesc] = useState(false)
  const [descVal, setDescVal] = useState('')
  const [showColorPicker, setShowColorPicker] = useState(false)
  const colorRef = useRef<HTMLDivElement>(null)

  // Add tasks
  const [addingTasks, setAddingTasks] = useState(false)
  const [taskSearch, setTaskSearch] = useState('')
  const epicTaskIds = new Set(epicTasks.map((t) => t.id))
  const addableTasks = allProjectTasks.filter(
    (t) => !epicTaskIds.has(t.id) && t.title.toLowerCase().includes(taskSearch.toLowerCase())
  )

  // Close color picker on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (colorRef.current && !colorRef.current.contains(e.target as Node)) {
        setShowColorPicker(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function startEditName() {
    setNameVal(epic?.name ?? '')
    setEditingName(true)
  }

  function saveName(e: React.FormEvent) {
    e.preventDefault()
    if (!nameVal.trim() || nameVal === epic?.name) { setEditingName(false); return }
    updateEpic.mutate(
      { epicId: epicId!, data: { name: nameVal.trim() } },
      {
        onSuccess: () => {
          setEditingName(false)
          qc.invalidateQueries({ queryKey: ['epic', epicId] })
        },
        onError: () => toast.error('Failed to rename epic'),
      }
    )
  }

  function saveDesc() {
    if (descVal === (epic?.description ?? '')) { setEditingDesc(false); return }
    updateEpic.mutate(
      { epicId: epicId!, data: { description: descVal || undefined } },
      {
        onSuccess: () => {
          setEditingDesc(false)
          qc.invalidateQueries({ queryKey: ['epic', epicId] })
        },
        onError: () => toast.error('Failed to save description'),
      }
    )
  }

  function handleDelete() {
    if (!confirm(`Delete epic "${epic?.name}"? Tasks will be unlinked but not deleted.`)) return
    deleteEpic.mutate(epicId!, {
      onSuccess: () => navigate(`/projects/${projectId}/epics`),
      onError: () => toast.error('Failed to delete epic'),
    })
  }

  function removeTask(task: Task) {
    updateTask.mutate({ id: task.id, data: { epic_id: null } })
  }

  function addTask(task: Task) {
    updateTask.mutate(
      { id: task.id, data: { epic_id: epicId } },
      { onError: () => toast.error('Failed to add task') }
    )
  }

  const pct = epic ? progressPercent(epic.done_count, epic.task_count) : 0
  const accentColor = epic?.color ?? '#8b5cf6'

  if (epicLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <span className="text-slate-400 dark:text-slate-500 text-sm">Loading…</span>
      </div>
    )
  }

  if (!epic) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-500 dark:text-slate-400 mb-3">Epic not found.</p>
          <Link to={`/projects/${projectId}/epics`} className="text-violet-600 text-sm hover:underline">← Back to Epics</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-6 h-16 flex items-center gap-4">
        <Link to="/" className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 text-sm transition-colors shrink-0">← Home</Link>
        {workspace && (
          <>
            <span className="text-slate-200 dark:text-slate-700 shrink-0">/</span>
            <Link
              to={`/workspaces/${workspace.id}`}
              className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-violet-600 bg-slate-100 dark:bg-slate-800 hover:bg-violet-50 dark:hover:bg-violet-950 px-2 py-0.5 rounded-md truncate max-w-[120px] transition-colors"
            >
              {workspace.name}
            </Link>
          </>
        )}
        <span className="text-slate-200 dark:text-slate-700 shrink-0">/</span>
        <Link
          to={`/projects/${projectId}`}
          className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-violet-600 bg-slate-100 dark:bg-slate-800 hover:bg-violet-50 dark:hover:bg-violet-950 px-2 py-0.5 rounded-md truncate max-w-[120px] transition-colors"
        >
          {project?.name}
        </Link>
        <span className="text-slate-200 dark:text-slate-700 shrink-0">/</span>
        <Link
          to={`/projects/${projectId}/epics`}
          className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-violet-600 bg-slate-100 dark:bg-slate-800 hover:bg-violet-50 dark:hover:bg-violet-950 px-2 py-0.5 rounded-md shrink-0 transition-colors"
        >
          Epics
        </Link>
        <span className="text-slate-200 dark:text-slate-700 shrink-0">/</span>
        <span
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ background: accentColor }}
        />
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[180px]">{epic.name}</span>

        <div className="ml-auto flex items-center gap-3">
          <Link
            to={`/projects/${projectId}/settings`}
            className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 text-sm transition-colors flex items-center gap-1.5"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
            Settings
          </Link>
          <HeaderActions />
        </div>
      </header>

      <main className="max-w-4xl mx-auto py-8 px-6">
        {/* Epic card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden mb-6">
          {/* Color bar */}
          <div className="h-1.5 w-full" style={{ backgroundColor: accentColor }} />

          <div className="p-6">
            {/* Title + actions row */}
            <div className="flex items-start gap-3 mb-4">
              {/* Color dot (clickable picker) */}
              <div className="relative mt-1" ref={colorRef}>
                <button
                  onClick={() => setShowColorPicker((v) => !v)}
                  className="w-4 h-4 rounded-full shrink-0 ring-2 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 hover:scale-110 transition-transform focus:outline-none"
                  style={{ backgroundColor: accentColor, ringColor: accentColor }}
                  aria-label="Change epic color"
                />
                {showColorPicker && (
                  <div className="absolute top-6 left-0 z-10 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg p-3 flex items-center gap-2">
                    {DEFAULT_COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => {
                          updateEpic.mutate(
                            { epicId: epicId!, data: { color: c } },
                            {
                              onSuccess: () => qc.invalidateQueries({ queryKey: ['epic', epicId] }),
                              onError: () => toast.error('Failed to update color'),
                            }
                          )
                          setShowColorPicker(false)
                        }}
                        className="w-6 h-6 rounded-full hover:scale-110 transition-transform focus:outline-none focus:ring-2 focus:ring-violet-500"
                        style={{ backgroundColor: c, outline: epic.color === c ? `2px solid ${c}` : undefined, outlineOffset: epic.color === c ? '2px' : undefined }}
                        aria-label={`Color ${c}`}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Name */}
              <div className="flex-1 min-w-0">
                {editingName ? (
                  <form onSubmit={saveName} className="flex gap-2">
                    <input
                      autoFocus
                      value={nameVal}
                      onChange={(e) => setNameVal(e.target.value)}
                      onKeyDown={(e) => e.key === 'Escape' && setEditingName(false)}
                      className="flex-1 border border-violet-300 dark:border-violet-600 rounded-lg px-3 py-1.5 text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    />
                    <button type="submit" className="text-xs px-3 py-1.5 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors font-medium">Save</button>
                    <button type="button" onClick={() => setEditingName(false)} className="text-xs px-2 py-1.5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-colors">Cancel</button>
                  </form>
                ) : (
                  <h1
                    className="text-xl font-bold text-slate-900 dark:text-slate-100 cursor-pointer hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
                    onClick={startEditName}
                    title="Click to rename"
                  >
                    {epic.name}
                  </h1>
                )}
              </div>

              {/* Status select */}
              <select
                value={epic.status}
                onChange={(e) =>
                  updateEpic.mutate(
                    { epicId: epicId!, data: { status: e.target.value as EpicStatus } },
                    {
                      onSuccess: () => qc.invalidateQueries({ queryKey: ['epic', epicId] }),
                      onError: () => toast.error('Failed to update status'),
                    }
                  )
                }
                className={`text-xs font-medium px-2.5 py-1 rounded-full border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-violet-500 ${STATUS_COLORS[epic.status]}`}
              >
                {(Object.keys(STATUS_LABELS) as EpicStatus[]).map((s) => (
                  <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                ))}
              </select>

              {/* Delete */}
              <button
                onClick={handleDelete}
                className="p-1.5 rounded-md text-slate-300 hover:text-red-500 dark:text-slate-600 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
                aria-label="Delete epic"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                  <path d="M10 11v6"/><path d="M14 11v6"/>
                  <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                </svg>
              </button>
            </div>

            {/* Dates row */}
            <div className="flex items-center gap-6 mb-4 text-xs text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-1.5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                <span className="text-slate-400 dark:text-slate-500">Start</span>
                <input
                  type="date"
                  value={epic.start_date ? epic.start_date.slice(0, 10) : ''}
                  onChange={(e) =>
                    updateEpic.mutate(
                      { epicId: epicId!, data: { start_date: e.target.value || undefined } },
                      {
                        onSuccess: () => qc.invalidateQueries({ queryKey: ['epic', epicId] }),
                        onError: () => toast.error('Failed to update start date'),
                      }
                    )
                  }
                  className="border-0 bg-transparent text-xs text-slate-600 dark:text-slate-300 cursor-pointer focus:outline-none focus:ring-1 focus:ring-violet-500 rounded"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
                <span className="text-slate-400 dark:text-slate-500">Due</span>
                <input
                  type="date"
                  value={epic.due_date ? epic.due_date.slice(0, 10) : ''}
                  onChange={(e) =>
                    updateEpic.mutate(
                      { epicId: epicId!, data: { due_date: e.target.value || undefined } },
                      {
                        onSuccess: () => qc.invalidateQueries({ queryKey: ['epic', epicId] }),
                        onError: () => toast.error('Failed to update due date'),
                      }
                    )
                  }
                  className="border-0 bg-transparent text-xs text-slate-600 dark:text-slate-300 cursor-pointer focus:outline-none focus:ring-1 focus:ring-violet-500 rounded"
                />
              </div>
            </div>

            {/* Description */}
            <div className="mb-4">
              {editingDesc ? (
                <div>
                  <textarea
                    autoFocus
                    value={descVal}
                    onChange={(e) => setDescVal(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Escape') setEditingDesc(false) }}
                    placeholder="Add a description…"
                    rows={3}
                    className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500 placeholder-slate-400 dark:placeholder-slate-500 resize-none"
                  />
                  <div className="flex gap-2 mt-2">
                    <button onClick={saveDesc} className="text-xs px-3 py-1.5 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors font-medium">Save</button>
                    <button onClick={() => setEditingDesc(false)} className="text-xs px-2 py-1.5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-colors">Cancel</button>
                  </div>
                </div>
              ) : (
                <p
                  onClick={() => { setDescVal(epic.description ?? ''); setEditingDesc(true) }}
                  className={`text-sm cursor-pointer rounded-lg px-1 -mx-1 py-1 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${epic.description ? 'text-slate-600 dark:text-slate-300' : 'text-slate-400 dark:text-slate-500 italic'}`}
                >
                  {epic.description ?? 'Add a description…'}
                </p>
              )}
            </div>

            {/* Progress bar */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Progress</span>
                <span className="text-slate-400 dark:text-slate-500 tabular-nums">
                  {epic.done_count} / {epic.task_count} tasks · {pct}%
                </span>
              </div>
              <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-2 rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, backgroundColor: accentColor }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Tasks section */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Tasks
              {epic.task_count > 0 && (
                <span className="ml-1.5 text-xs font-medium text-slate-400 bg-slate-100 dark:bg-slate-800 dark:text-slate-500 px-1.5 py-0.5 rounded-full">{epic.task_count}</span>
              )}
            </h2>
            <button
              onClick={() => { setAddingTasks((v) => !v); setTaskSearch('') }}
              className="flex items-center gap-1.5 text-xs font-medium text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Add tasks
            </button>
          </div>

          {/* Add tasks panel */}
          {addingTasks && (
            <div className="px-6 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
              <input
                autoFocus
                value={taskSearch}
                onChange={(e) => setTaskSearch(e.target.value)}
                placeholder="Search tasks to add…"
                className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 dark:placeholder-slate-500"
              />
              {taskSearch && addableTasks.length === 0 && (
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">No matching tasks without an epic.</p>
              )}
              {addableTasks.slice(0, 8).map((task) => {
                const status = task.status_id ? statusMap[task.status_id] : null
                return (
                  <div
                    key={task.id}
                    className="flex items-center justify-between gap-3 mt-2 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-violet-300 dark:hover:border-violet-700 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {status && (
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: status.color }} />
                      )}
                      <span className="text-sm text-slate-700 dark:text-slate-300 truncate">{task.title}</span>
                      <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0">{task.task_key}</span>
                    </div>
                    <button
                      onClick={() => addTask(task)}
                      className="text-xs font-medium text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 shrink-0 transition-colors"
                    >
                      + Add
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {/* Task list */}
          {tasksLoading ? (
            <div className="px-6 py-8 space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : epicTasks.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-slate-400 dark:text-slate-500 text-sm">No tasks in this epic yet.</p>
              <button
                onClick={() => setAddingTasks(true)}
                className="mt-3 text-xs text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 font-medium transition-colors"
              >
                + Add tasks
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[560px]">
                <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Task</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Priority</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Assignee</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Due</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {epicTasks.map((task) => {
                    const status = task.status_id ? statusMap[task.status_id] : null
                    const assignee = task.assignee_ids?.[0] ? memberMap[task.assignee_ids[0]] : null
                    return (
                      <tr key={task.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="px-6 py-3">
                          <Link
                            to={`/tasks/${task.id}`}
                            className="flex items-center gap-2 group"
                          >
                            <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0 tabular-nums">{task.task_key}</span>
                            <span className="text-slate-700 dark:text-slate-300 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors truncate max-w-[280px]">{task.title}</span>
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          {status ? (
                            <span
                              className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full"
                              style={{ backgroundColor: status.color + '20', color: status.color }}
                            >
                              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: status.color }} />
                              {status.name}
                            </span>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-600 text-sm">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {task.priority && task.priority !== 'none' ? (
                            <span className={`flex items-center gap-1.5 text-xs font-medium ${PRIORITY_DOT_COLORS[task.priority as Priority] ?? ''}`}>
                              <span className="w-1.5 h-1.5 rounded-full bg-current" />
                              <span className="capitalize">{task.priority}</span>
                            </span>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-600 text-sm">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {assignee ? (
                            <div className="flex items-center gap-1.5">
                              <div className="w-5 h-5 rounded-full bg-violet-100 dark:bg-violet-900 flex items-center justify-center text-[10px] font-semibold text-violet-600 dark:text-violet-300 shrink-0">
                                {assignee.display_name[0].toUpperCase()}
                              </div>
                              <span className="text-xs text-slate-600 dark:text-slate-400 truncate max-w-[80px]">{assignee.display_name}</span>
                            </div>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-600 text-sm">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <DueDateBadge dueDate={task.due_date} complete={status?.is_complete ?? false} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => removeTask(task)}
                            className="text-slate-300 dark:text-slate-600 hover:text-red-400 dark:hover:text-red-400 transition-colors"
                            title="Remove from epic"
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                              <path d="M18 6L6 18M6 6l12 12"/>
                            </svg>
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
