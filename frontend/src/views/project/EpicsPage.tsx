import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { projectsApi } from '@/api/projects'
import { useEpics, useCreateEpic, useUpdateEpic, useDeleteEpic, type Epic } from '@/api/epics'
import ProjectHeader from '@/components/ProjectHeader'
import { toast } from '@/store/toastStore'

const EPIC_STATUS_COLORS: Record<string, string> = {
  not_started: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
  in_progress: 'bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400',
  done: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400',
}

const DEFAULT_COLORS = [
  '#8b5cf6', '#38bdf8', '#34d399', '#fbbf24', '#fb7185', '#818cf8',
]

function progressPercent(done: number, total: number) {
  if (total === 0) return 0
  return Math.round((done / total) * 100)
}

export default function EpicsPage() {
  const { projectId } = useParams<{ projectId: string }>()

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.get(projectId!),
    enabled: !!projectId,
  })

  const { data: epics = [], isLoading } = useEpics(projectId)
  const createEpic = useCreateEpic(projectId!)
  const updateEpic = useUpdateEpic(projectId!)
  const deleteEpic = useDeleteEpic(projectId!)

  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(DEFAULT_COLORS[0])

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    createEpic.mutate(
      { name: newName.trim(), color: newColor },
      {
        onSuccess: () => {
          setCreating(false)
          setNewName('')
          setNewColor(DEFAULT_COLORS[0])
        },
        onError: () => toast.error('Failed to create epic'),
      },
    )
  }

  function startRename(epic: Epic) {
    setEditingId(epic.id)
    setEditName(epic.name)
  }

  function handleRename(e: React.FormEvent, epicId: string) {
    e.preventDefault()
    if (!editName.trim()) return
    updateEpic.mutate(
      { epicId, data: { name: editName.trim() } },
      {
        onSuccess: () => setEditingId(null),
        onError: () => toast.error('Failed to rename epic'),
      },
    )
  }

  function handleDelete(epicId: string, name: string) {
    if (!confirm(`Delete epic "${name}"? Tasks will be unlinked but not deleted.`)) return
    deleteEpic.mutate(epicId, {
      onError: () => toast.error('Failed to delete epic'),
    })
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <ProjectHeader projectId={projectId!} activeTab="epics" />

      <main className="max-w-5xl mx-auto py-8 sm:py-10 px-4 sm:px-6">
        {/* Page title + actions */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Epics</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {epics.length === 0 ? 'No epics yet' : `${epics.length} epic${epics.length === 1 ? '' : 's'}`}
            </p>
          </div>
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 bg-violet-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-violet-700 transition-colors font-medium"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            New Epic
          </button>
        </div>

        {/* Create form */}
        {creating && (
          <form
            onSubmit={handleCreate}
            className="mb-5 bg-white dark:bg-slate-900 border border-violet-200 dark:border-violet-800 rounded-xl p-4 shadow-sm flex items-center gap-3"
          >
            {/* Color picker */}
            <div className="flex items-center gap-1 shrink-0">
              {DEFAULT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setNewColor(c)}
                  className="w-5 h-5 rounded-full transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  style={{ backgroundColor: c, outline: newColor === c ? `2px solid ${c}` : undefined, outlineOffset: newColor === c ? '2px' : undefined }}
                  aria-label={`Color ${c}`}
                />
              ))}
            </div>
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Epic name…"
              className="flex-1 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 dark:placeholder-slate-500"
            />
            <button
              type="submit"
              disabled={!newName.trim() || createEpic.isPending}
              className="bg-violet-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-violet-700 transition-colors font-medium disabled:opacity-50"
            >
              Create
            </button>
            <button
              type="button"
              onClick={() => { setCreating(false); setNewName('') }}
              className="text-sm px-3 py-2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
            >
              Cancel
            </button>
          </form>
        )}

        {/* Loading skeleton */}
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl h-36 animate-pulse" />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && epics.length === 0 && !creating && (
          <div className="text-center py-20 bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
            <div className="w-12 h-12 bg-violet-50 dark:bg-violet-950 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-violet-400" aria-hidden="true">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
              </svg>
            </div>
            <p className="text-slate-700 dark:text-slate-300 font-medium mb-1">No epics yet</p>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-5">
              Group tasks by feature or milestone to track feature progress across teams.
            </p>
            <button
              onClick={() => setCreating(true)}
              className="bg-violet-600 text-white text-sm px-5 py-2 rounded-lg hover:bg-violet-700 transition-colors font-medium"
            >
              Create first epic
            </button>
          </div>
        )}

        {/* Epic cards grid */}
        {!isLoading && epics.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {epics.map((epic) => (
              <EpicCard
                key={epic.id}
                epic={epic}
                projectId={projectId!}
                editingId={editingId}
                editName={editName}
                onStartRename={startRename}
                onEditNameChange={setEditName}
                onRename={handleRename}
                onCancelRename={() => setEditingId(null)}
                onDelete={handleDelete}
                onStatusChange={(epicId, status) =>
                  updateEpic.mutate({ epicId, data: { status: status as import('@/api/epics').EpicStatus } }, {
                    onError: () => toast.error('Failed to update status'),
                  })
                }
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

function EpicCard({
  epic,
  projectId,
  editingId,
  editName,
  onStartRename,
  onEditNameChange,
  onRename,
  onCancelRename,
  onDelete,
  onStatusChange,
}: {
  epic: Epic
  projectId: string
  editingId: string | null
  editName: string
  onStartRename: (epic: Epic) => void
  onEditNameChange: (v: string) => void
  onRename: (e: React.FormEvent, epicId: string) => void
  onCancelRename: () => void
  onDelete: (epicId: string, name: string) => void
  onStatusChange: (epicId: string, status: string) => void
}) {
  const pct = progressPercent(epic.done_count, epic.task_count)
  const accentColor = epic.color ?? '#8b5cf6'
  const isEditing = editingId === epic.id

  return (
    <div className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden hover:border-violet-300 dark:hover:border-violet-700 hover:shadow-md transition-all">
      {/* Color bar */}
      <div className="h-1.5 w-full" style={{ backgroundColor: accentColor }} />

      <div className="p-5">
        {/* Title row */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <form onSubmit={(e) => onRename(e, epic.id)} className="flex gap-2">
                <input
                  autoFocus
                  value={editName}
                  onChange={(e) => onEditNameChange(e.target.value)}
                  className="flex-1 border border-violet-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
                <button type="submit" className="text-xs px-2.5 py-1 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors">Save</button>
                <button type="button" onClick={onCancelRename} className="text-xs px-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-colors">✕</button>
              </form>
            ) : (
              <Link to={`/projects/${projectId}/epics/${epic.id}`}>
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-base leading-snug truncate hover:text-violet-600 dark:hover:text-violet-400 transition-colors">
                  {epic.name}
                </h3>
              </Link>
            )}
          </div>

          {/* Actions — visible on hover */}
          {!isEditing && (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              <button
                onClick={() => onStartRename(epic)}
                className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label="Rename epic"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
              <button
                onClick={() => onDelete(epic.id, epic.name)}
                className="p-1.5 rounded-md text-slate-300 hover:text-red-500 dark:text-slate-600 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label="Delete epic"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                  <path d="M10 11v6"/><path d="M14 11v6"/>
                  <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* Status + task count */}
        <div className="flex items-center gap-2 mb-4">
          <select
            value={epic.status}
            onChange={(e) => onStatusChange(epic.id, e.target.value)}
            className={`text-xs font-medium px-2.5 py-1 rounded-full border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-violet-500 ${EPIC_STATUS_COLORS[epic.status]}`}
          >
            <option value="not_started">Not started</option>
            <option value="in_progress">In progress</option>
            <option value="done">Done</option>
          </select>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {epic.task_count} {epic.task_count === 1 ? 'task' : 'tasks'}
          </span>
        </div>

        {/* Progress bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-500 dark:text-slate-400">Progress</span>
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{pct}%</span>
          </div>
          <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${pct}%`, backgroundColor: accentColor }}
            />
          </div>
        </div>

        {/* Date range */}
        {(epic.start_date || epic.due_date) && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
            {epic.start_date ? new Date(epic.start_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—'}
            {' → '}
            {epic.due_date ? new Date(epic.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
          </p>
        )}
      </div>
    </div>
  )
}
