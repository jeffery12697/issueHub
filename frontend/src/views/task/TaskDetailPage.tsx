import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { tasksApi, type Priority } from '@/api/tasks'
import { listsApi } from '@/api/lists'
import { auditApi } from '@/api/audit'
import { dependenciesApi } from '@/api/dependencies'
import { useComments, useCreateComment, useDeleteComment } from '@/api/comments'
import { useFieldDefinitions, useFieldValues, useUpsertValues, type FieldDefinition, type FieldValue } from '@/api/customFields'
import { useAuthStore } from '@/store/authStore'

const PRIORITIES: Priority[] = ['none', 'low', 'medium', 'high', 'urgent']

export default function TaskDetailPage() {
  const { taskId } = useParams<{ taskId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: task, isLoading } = useQuery({
    queryKey: ['task', taskId],
    queryFn: () => tasksApi.get(taskId!),
  })

  const { data: list } = useQuery({
    queryKey: ['list', task?.list_id],
    queryFn: () => listsApi.get(task!.list_id!),
    enabled: !!task?.list_id,
  })

  const { data: blockedBy = [] } = useQuery({
    queryKey: ['blocked-by', taskId],
    queryFn: () => dependenciesApi.getBlockedBy(taskId!),
    enabled: !!taskId,
  })

  const { data: blocking = [] } = useQuery({
    queryKey: ['blocking', taskId],
    queryFn: () => dependenciesApi.getBlocking(taskId!),
    enabled: !!taskId,
  })

  const addBlockedBy = useMutation({
    mutationFn: (dependsOnId: string) => dependenciesApi.addBlockedBy(taskId!, dependsOnId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['blocked-by', taskId] })
      setBlockingInput('')
      setAddingBlockedBy(false)
    },
  })

  const removeBlockedBy = useMutation({
    mutationFn: (dependsOnId: string) => dependenciesApi.removeBlockedBy(taskId!, dependsOnId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['blocked-by', taskId] }),
  })

  const { data: auditLogs = [] } = useQuery({
    queryKey: ['audit', taskId],
    queryFn: () => auditApi.listForTask(taskId!),
    enabled: !!taskId,
  })

  const { data: subtasks = [] } = useQuery({
    queryKey: ['subtasks', taskId],
    queryFn: () => tasksApi.listSubtasks(taskId!),
    enabled: !!taskId,
  })

  const currentUser = useAuthStore((s) => s.user)

  const { data: fieldDefs = [] } = useFieldDefinitions(task?.list_id ?? undefined)
  const { data: fieldValues = [] } = useFieldValues(taskId!)
  const upsertValues = useUpsertValues(taskId!)

  const { data: comments = [] } = useComments(taskId!)
  const createComment = useCreateComment(taskId!)
  const deleteComment = useDeleteComment(taskId!)

  const [editingTitle, setEditingTitle] = useState(false)
  const [title, setTitle] = useState('')
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('')
  const [addingSubtask, setAddingSubtask] = useState(false)
  const [blockingInput, setBlockingInput] = useState('')
  const [addingBlockedBy, setAddingBlockedBy] = useState(false)
  const [commentBody, setCommentBody] = useState('')

  const updateTask = useMutation({
    mutationFn: (data: Parameters<typeof tasksApi.update>[1]) =>
      tasksApi.update(taskId!, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task', taskId] })
      qc.invalidateQueries({ queryKey: ['audit', taskId] })
    },
  })

  const promoteTask = useMutation({
    mutationFn: () => tasksApi.promote(taskId!),
    onSuccess: () => {
      if (task?.parent_task_id) qc.invalidateQueries({ queryKey: ['subtasks', task.parent_task_id] })
      qc.invalidateQueries({ queryKey: ['task', taskId] })
      if (task?.list_id) qc.invalidateQueries({ queryKey: ['tasks', task.list_id] })
    },
  })

  const deleteTask = useMutation({
    mutationFn: () => tasksApi.delete(taskId!),
    onSuccess: () => {
      if (task?.list_id) {
        qc.invalidateQueries({ queryKey: ['tasks', task.list_id] })
      }
      navigate(-1)
    },
  })

  const createSubtask = useMutation({
    mutationFn: (title: string) => tasksApi.createSubtask(taskId!, { title }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subtasks', taskId] })
      setNewSubtaskTitle('')
      setAddingSubtask(false)
    },
  })

  if (isLoading) return <div className="flex items-center justify-center h-screen text-slate-400">Loading...</div>
  if (!task) return <div className="flex items-center justify-center h-screen text-slate-400">Task not found</div>

  const statuses = list?.statuses ?? []

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 h-14 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="text-slate-400 hover:text-slate-600 text-sm flex items-center gap-1 transition-colors"
        >
          ← Back
        </button>
        <span className="text-slate-300">/</span>
        <span className="text-sm text-slate-500 truncate">{task.title}</span>
        {task.parent_task_id && (
          <button
            onClick={() => promoteTask.mutate()}
            className="ml-auto text-xs text-violet-500 hover:text-violet-700 border border-violet-200 px-3 py-1 rounded-full transition-colors"
          >
            ↑ Promote to top-level
          </button>
        )}
        <button
          onClick={() => deleteTask.mutate()}
          className={`${task.parent_task_id ? '' : 'ml-auto'} text-xs text-slate-400 hover:text-red-500 transition-colors`}
        >
          Delete
        </button>
      </header>

      <main className="max-w-6xl mx-auto py-8 px-6">
        <div className="flex gap-6 items-start">

          {/* LEFT COLUMN */}
          <div className="flex-1 min-w-0 space-y-5">

            {/* Title */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              {editingTitle ? (
                <form onSubmit={(e) => {
                  e.preventDefault()
                  updateTask.mutate({ title })
                  setEditingTitle(false)
                }}>
                  <input
                    autoFocus
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full text-xl font-bold border-b-2 border-violet-400 outline-none pb-1 text-slate-900 bg-transparent"
                  />
                </form>
              ) : (
                <h1
                  className="text-xl font-bold text-slate-900 cursor-pointer hover:text-violet-600 transition-colors"
                  onClick={() => { setTitle(task.title); setEditingTitle(true) }}
                >
                  {task.title}
                </h1>
              )}
            </div>

            {/* Description */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 block">Description</label>
              <textarea
                defaultValue={task.description ?? ''}
                onBlur={(e) => updateTask.mutate({ description: e.target.value })}
                placeholder="Add a description..."
                rows={5}
                className="w-full text-sm text-slate-700 border border-slate-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              />
            </div>

            {/* Custom Fields */}
            {fieldDefs.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 block">Custom Fields</label>
                <div className="space-y-3">
                  {fieldDefs.map(field => {
                    const valueMap = Object.fromEntries(fieldValues.map(v => [v.field_id, v]))
                    return (
                      <CustomFieldInput
                        key={field.id}
                        field={field}
                        value={valueMap[field.id]}
                        onSave={(val) => upsertValues.mutate({ [field.id]: val })}
                      />
                    )
                  })}
                </div>
              </div>
            )}

            {/* Subtasks */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Subtasks{' '}
                  {subtasks.length > 0 && (
                    <span className="ml-1 bg-slate-100 text-slate-500 text-xs px-1.5 py-0.5 rounded-full font-normal normal-case tracking-normal">
                      {subtasks.length}
                    </span>
                  )}
                </label>
                <button
                  onClick={() => setAddingSubtask(true)}
                  className="text-xs text-violet-600 hover:text-violet-700 font-medium transition-colors"
                >
                  + Add
                </button>
              </div>

              {addingSubtask && (
                <form
                  className="flex gap-2 mb-3"
                  onSubmit={(e) => { e.preventDefault(); createSubtask.mutate(newSubtaskTitle) }}
                >
                  <input
                    autoFocus
                    value={newSubtaskTitle}
                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                    placeholder="Subtask title"
                    className="flex-1 border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                  <button type="submit" className="bg-violet-600 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-violet-700 transition-colors">Add</button>
                  <button type="button" onClick={() => setAddingSubtask(false)} className="text-xs px-2 text-slate-500 hover:text-slate-700 transition-colors">Cancel</button>
                </form>
              )}

              {subtasks.length > 0 && (
                <ul className="space-y-1">
                  {subtasks.map((sub) => (
                    <li key={sub.id}>
                      <button
                        onClick={() => navigate(`/tasks/${sub.id}`)}
                        className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-100 hover:border-violet-200 hover:bg-violet-50 text-sm text-slate-700 transition-colors"
                      >
                        <span className="text-slate-300">↳</span>
                        <span className="flex-1">{sub.title}</span>
                        {sub.priority !== 'none' && (
                          <span className="text-xs text-slate-400 capitalize">{sub.priority}</span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {subtasks.length === 0 && !addingSubtask && (
                <p className="text-sm text-slate-400">No subtasks yet.</p>
              )}
            </div>

            {/* Dependencies */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Blocked by</label>
                <button
                  onClick={() => setAddingBlockedBy(true)}
                  className="text-xs text-violet-600 hover:text-violet-700 font-medium transition-colors"
                >
                  + Add
                </button>
              </div>

              {addingBlockedBy && (
                <form
                  className="flex gap-2 mb-3"
                  onSubmit={(e) => { e.preventDefault(); addBlockedBy.mutate(blockingInput) }}
                >
                  <input
                    autoFocus
                    value={blockingInput}
                    onChange={(e) => setBlockingInput(e.target.value)}
                    placeholder="Paste task ID"
                    className="flex-1 border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                  <button type="submit" className="bg-violet-600 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-violet-700 transition-colors">Add</button>
                  <button type="button" onClick={() => setAddingBlockedBy(false)} className="text-xs px-2 text-slate-500 hover:text-slate-700 transition-colors">Cancel</button>
                </form>
              )}

              {blockedBy.length > 0 ? (
                <ul className="space-y-1">
                  {blockedBy.map((t) => (
                    <li key={t.id} className="flex items-center gap-2 text-sm">
                      <button
                        onClick={() => navigate(`/tasks/${t.id}`)}
                        className="flex-1 text-left px-3 py-1.5 rounded-lg border border-slate-100 hover:border-red-200 hover:bg-red-50 text-slate-700 transition-colors"
                      >
                        <span className="text-red-400 mr-2">⊘</span>{t.title}
                      </button>
                      <button
                        onClick={() => removeBlockedBy.mutate(t.id)}
                        className="text-slate-300 hover:text-red-400 text-xs transition-colors"
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              ) : !addingBlockedBy && (
                <p className="text-xs text-slate-400">No blockers.</p>
              )}

              {blocking.length > 0 && (
                <div className="mt-4">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Blocking</label>
                  <ul className="mt-2 space-y-1">
                    {blocking.map((t) => (
                      <li key={t.id}>
                        <button
                          onClick={() => navigate(`/tasks/${t.id}`)}
                          className="w-full text-left px-3 py-1.5 rounded-lg border border-slate-100 hover:border-orange-200 hover:bg-orange-50 text-sm text-slate-700 transition-colors"
                        >
                          <span className="text-orange-400 mr-2">⚡</span>{t.title}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

          </div>

          {/* RIGHT COLUMN */}
          <div className="w-80 shrink-0 space-y-4">

            {/* Status */}
            {statuses.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 block">Status</label>
                <div className="flex flex-wrap gap-2">
                  {statuses.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => updateTask.mutate({ status_id: s.id })}
                      className="text-xs px-3 py-1.5 rounded-full border-2 font-medium transition-colors"
                      style={
                        task.status_id === s.id
                          ? { backgroundColor: s.color, color: '#fff', borderColor: s.color }
                          : { borderColor: s.color, color: s.color }
                      }
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Priority */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 block">Priority</label>
              <div className="flex flex-wrap gap-1.5">
                {PRIORITIES.map((p) => (
                  <button
                    key={p}
                    onClick={() => updateTask.mutate({ priority: p })}
                    className={`text-xs px-3 py-1.5 rounded-lg border font-medium capitalize transition-colors ${
                      task.priority === p
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'border-slate-200 text-slate-500 hover:border-slate-400'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* History */}
            {auditLogs.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 block">History</label>
                <ul className="space-y-2.5">
                  {auditLogs.map((log) => (
                    <li key={log.id} className="flex gap-2 text-xs">
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-300 mt-1.5 shrink-0" />
                      <div>
                        <span className="font-medium text-slate-700">{log.actor_name}</span>{' '}
                        <span className="text-slate-500 capitalize">{log.action}</span>
                        {log.changes && Object.entries(log.changes).map(([field, [oldVal, newVal]]) => (
                          <div key={field} className="text-slate-400 mt-0.5">
                            {field}: <span className="line-through">{oldVal ?? '—'}</span> → <span className="text-slate-600">{newVal as string}</span>
                          </div>
                        ))}
                        <div className="text-slate-300 mt-0.5">{new Date(log.created_at).toLocaleString()}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Comments */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 block">
                Comments{' '}
                {comments.length > 0 && (
                  <span className="ml-1 bg-slate-100 text-slate-500 text-xs px-1.5 py-0.5 rounded-full font-normal normal-case tracking-normal">
                    {comments.length}
                  </span>
                )}
              </label>

              {comments.length > 0 && (
                <ul className="mb-3 space-y-3">
                  {comments.map((c) => (
                    <li key={c.id} className="flex gap-2 text-sm">
                      <div className="flex-1 bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
                        <p className="text-slate-800 whitespace-pre-wrap">{c.body}</p>
                        <p className="text-xs text-slate-400 mt-1">
                          {new Date(c.created_at).toLocaleString()}
                        </p>
                      </div>
                      {currentUser?.id === c.author_id && (
                        <button
                          onClick={() => deleteComment.mutate(c.id)}
                          className="text-slate-300 hover:text-red-400 text-xs self-start mt-2 transition-colors"
                        >
                          ✕
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (!commentBody.trim()) return
                  createComment.mutate(
                    { body: commentBody.trim() },
                    { onSuccess: () => setCommentBody('') },
                  )
                }}
              >
                <textarea
                  value={commentBody}
                  onChange={(e) => setCommentBody(e.target.value)}
                  placeholder="Add a comment... Use @name to mention someone"
                  rows={2}
                  className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
                <button
                  type="submit"
                  disabled={!commentBody.trim()}
                  className="self-end bg-violet-600 text-white text-xs px-3 py-2 rounded-lg hover:bg-violet-700 transition-colors disabled:opacity-40"
                >
                  Post
                </button>
              </form>
            </div>

          </div>

        </div>
      </main>
    </div>
  )
}

function CustomFieldInput({ field, value, onSave }: {
  field: FieldDefinition
  value: FieldValue | undefined
  onSave: (val: unknown) => void
}) {
  // Get current value based on field type
  const currentVal = (() => {
    if (!value) return null
    switch (field.field_type) {
      case 'text': case 'url': return value.value_text
      case 'number': return value.value_number
      case 'date': return value.value_date?.slice(0, 10) ?? null
      case 'checkbox': return value.value_boolean
      case 'dropdown': return value.value_json?.selected ?? null
      default: return null
    }
  })()

  return (
    <div className="flex items-start gap-3">
      <label className="text-sm font-medium text-slate-600 w-32 shrink-0 pt-1.5">
        {field.name}
        {field.is_required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      <div className="flex-1">
        {field.field_type === 'checkbox' && (
          <input
            type="checkbox"
            checked={!!currentVal}
            onChange={(e) => onSave(e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 text-violet-600 mt-1.5"
          />
        )}
        {(field.field_type === 'text' || field.field_type === 'url') && (
          <input
            type={field.field_type === 'url' ? 'url' : 'text'}
            defaultValue={currentVal as string ?? ''}
            onBlur={(e) => onSave(e.target.value || null)}
            placeholder={field.is_required ? 'Required' : 'Empty'}
            className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        )}
        {field.field_type === 'number' && (
          <input
            type="number"
            defaultValue={currentVal as number ?? ''}
            onBlur={(e) => onSave(e.target.value ? Number(e.target.value) : null)}
            placeholder={field.is_required ? 'Required' : 'Empty'}
            className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        )}
        {field.field_type === 'date' && (
          <input
            type="date"
            defaultValue={currentVal as string ?? ''}
            onChange={(e) => onSave(e.target.value || null)}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        )}
        {field.field_type === 'dropdown' && (
          <select
            value={(currentVal as string) ?? ''}
            onChange={(e) => onSave(e.target.value ? { selected: e.target.value } : null)}
            className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            <option value="">— Select —</option>
            {(field.options_json ?? []).map((opt: string) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        )}
      </div>
    </div>
  )
}
