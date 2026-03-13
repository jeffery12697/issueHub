import { useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { tasksApi, type Priority } from '@/api/tasks'
import { listsApi } from '@/api/lists'
import { auditApi, type AuditLog } from '@/api/audit'
import { dependenciesApi } from '@/api/dependencies'
import { useComments, useCreateComment, useDeleteComment } from '@/api/comments'
import { useFieldDefinitions, useFieldValues, useUpsertValues, type FieldDefinition, type FieldValue } from '@/api/customFields'
import { useAuthStore } from '@/store/authStore'
import { useTaskSocket } from '@/hooks/useTaskSocket'
import { useWorkspaceMembers } from '@/api/workspaces'
import { useTaskLinks, useAddLink, useDeleteLink } from '@/api/links'
import HeaderActions from '@/components/HeaderActions'

const PRIORITIES: Priority[] = ['none', 'low', 'medium', 'high', 'urgent']

export default function TaskDetailPage() {
  const { taskId } = useParams<{ taskId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()

  useTaskSocket(taskId)

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

  const { data: links = [] } = useTaskLinks(taskId)
  const addLink = useAddLink(taskId!)
  const deleteLink = useDeleteLink(taskId!)

  const { data: comments = [] } = useComments(taskId!)
  const createComment = useCreateComment(taskId!)
  const deleteComment = useDeleteComment(taskId!)
  const { data: members = [] } = useWorkspaceMembers(task?.workspace_id)

  const [editingTitle, setEditingTitle] = useState(false)
  const [title, setTitle] = useState('')
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('')
  const [addingSubtask, setAddingSubtask] = useState(false)
  const [blockingInput, setBlockingInput] = useState('')
  const [addingBlockedBy, setAddingBlockedBy] = useState(false)
  const [addingLink, setAddingLink] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [linkTitle, setLinkTitle] = useState('')
  const [commentBody, setCommentBody] = useState('')

  const updateTask = useMutation({
    mutationFn: (data: Parameters<typeof tasksApi.update>[1]) =>
      tasksApi.update(taskId!, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task', taskId] })
      qc.invalidateQueries({ queryKey: ['audit', taskId] })
      if (task?.list_id) qc.invalidateQueries({ queryKey: ['tasks', task.list_id] })
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
        <HeaderActions />
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

            {/* Links */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Links{' '}
                  {links.length > 0 && (
                    <span className="ml-1 bg-slate-100 text-slate-500 text-xs px-1.5 py-0.5 rounded-full font-normal normal-case tracking-normal">
                      {links.length}
                    </span>
                  )}
                </label>
                <button
                  onClick={() => setAddingLink(true)}
                  className="text-xs text-violet-600 hover:text-violet-700 font-medium transition-colors"
                >
                  + Add
                </button>
              </div>

              {addingLink && (
                <form
                  className="mb-3 space-y-2"
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (!linkUrl.trim()) return
                    addLink.mutate(
                      { url: linkUrl.trim(), title: linkTitle.trim() || undefined },
                      {
                        onSuccess: () => {
                          setLinkUrl('')
                          setLinkTitle('')
                          setAddingLink(false)
                        },
                      }
                    )
                  }}
                >
                  <input
                    autoFocus
                    type="url"
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    placeholder="URL (required)"
                    className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                  <input
                    type="text"
                    value={linkTitle}
                    onChange={(e) => setLinkTitle(e.target.value)}
                    placeholder="Title (optional)"
                    className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                  <div className="flex gap-2">
                    <button type="submit" className="bg-violet-600 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-violet-700 transition-colors">Add</button>
                    <button type="button" onClick={() => { setAddingLink(false); setLinkUrl(''); setLinkTitle('') }} className="text-xs px-2 text-slate-500 hover:text-slate-700 transition-colors">Cancel</button>
                  </div>
                </form>
              )}

              {links.length > 0 ? (
                <ul className="space-y-1">
                  {links.map((link) => (
                    <li key={link.id} className="flex items-center gap-2 text-sm">
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 text-violet-600 hover:text-violet-800 hover:underline truncate"
                      >
                        {link.title || link.url}
                      </a>
                      <button
                        onClick={() => deleteLink.mutate(link.id)}
                        className="text-slate-300 hover:text-red-400 text-xs shrink-0 transition-colors"
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              ) : !addingLink && (
                <p className="text-xs text-slate-400">No links yet.</p>
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

            {/* Assignees */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 block">Assignees</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {task.assignee_ids.map((id) => {
                  const m = members.find((m) => m.user_id === id)
                  return (
                    <span
                      key={id}
                      className="flex items-center gap-1.5 bg-violet-50 text-violet-700 text-xs px-2 py-1 rounded-full border border-violet-200"
                    >
                      <span className="w-4 h-4 rounded-full bg-violet-200 flex items-center justify-center text-[10px] font-bold shrink-0">
                        {(m?.display_name ?? '?')[0].toUpperCase()}
                      </span>
                      {m?.display_name ?? id.slice(0, 8)}
                      <button
                        onClick={() => updateTask.mutate({ assignee_ids: task.assignee_ids.filter((a) => a !== id) })}
                        className="text-violet-400 hover:text-red-500 transition-colors leading-none"
                      >
                        ✕
                      </button>
                    </span>
                  )
                })}
              </div>
              <select
                value=""
                onChange={(e) => {
                  if (!e.target.value) return
                  if (!task.assignee_ids.includes(e.target.value)) {
                    updateTask.mutate({ assignee_ids: [...task.assignee_ids, e.target.value] })
                  }
                }}
                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                <option value="">+ Add assignee…</option>
                {members
                  .filter((m) => !task.assignee_ids.includes(m.user_id))
                  .map((m) => (
                    <option key={m.user_id} value={m.user_id}>{m.display_name}</option>
                  ))}
              </select>
            </div>

            {/* Reviewer */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 block">Reviewer</label>
              {task.reviewer_id ? (
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-sm text-slate-700">
                    <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-bold shrink-0">
                      {(members.find((m) => m.user_id === task.reviewer_id)?.display_name ?? '?')[0].toUpperCase()}
                    </span>
                    {members.find((m) => m.user_id === task.reviewer_id)?.display_name ?? task.reviewer_id.slice(0, 8)}
                  </span>
                  <button
                    onClick={() => updateTask.mutate({ reviewer_id: null })}
                    className="text-slate-300 hover:text-red-400 text-xs transition-colors"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <select
                  value=""
                  onChange={(e) => { if (e.target.value) updateTask.mutate({ reviewer_id: e.target.value }) }}
                  className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  <option value="">Assign reviewer…</option>
                  {members.map((m) => (
                    <option key={m.user_id} value={m.user_id}>{m.display_name}</option>
                  ))}
                </select>
              )}
            </div>

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
                        <p className="text-xs font-medium text-violet-700 mb-1">{c.author_name}</p>
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

              <CommentForm
                members={members}
                onSubmit={(body) =>
                  createComment.mutate({ body }, { onSuccess: () => setCommentBody('') })
                }
                value={commentBody}
                onChange={setCommentBody}
              />
            </div>

            {/* History */}
            {auditLogs.length > 0 && (
              <HistorySection logs={auditLogs} />
            )}

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

const HISTORY_INITIAL = 5

function HistorySection({ logs }: { logs: AuditLog[] }) {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? logs : logs.slice(0, HISTORY_INITIAL)
  const hidden = logs.length - HISTORY_INITIAL

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 block">History</label>
      <ul className="space-y-2.5">
        {visible.map((log) => (
          <li key={log.id} className="flex gap-2 text-xs">
            <div className="w-1.5 h-1.5 rounded-full bg-slate-300 mt-1.5 shrink-0" />
            <div>
              <span className="font-medium text-slate-700">{log.actor_name}</span>{' '}
              <span className="text-slate-500 capitalize">{log.action}</span>
              {log.changes && !['link_added', 'link_removed'].includes(log.action) && Object.entries(log.changes).map(([field, [oldVal, newVal]]) => (
                <div key={field} className="text-slate-400 mt-0.5">
                  {field}: <span className="line-through">{oldVal ?? '—'}</span> → <span className="text-slate-600">{newVal as string}</span>
                </div>
              ))}
              <div className="text-slate-300 mt-0.5">{new Date(log.created_at).toLocaleString()}</div>
            </div>
          </li>
        ))}
      </ul>
      {hidden > 0 && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 text-xs text-violet-600 hover:text-violet-700 font-medium transition-colors"
        >
          {expanded ? '↑ Show less' : `↓ Show ${hidden} more`}
        </button>
      )}
    </div>
  )
}

import type { Member } from '@/api/workspaces'

function CommentForm({
  members,
  onSubmit,
  value,
  onChange,
}: {
  members: Member[]
  onSubmit: (body: string) => void
  value: string
  onChange: (v: string) => void
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [mentionStart, setMentionStart] = useState(0)

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value
    onChange(val)
    const cursor = e.target.selectionStart ?? val.length
    const before = val.slice(0, cursor)
    const match = before.match(/@(\w*)$/)
    if (match) {
      setMentionQuery(match[1].toLowerCase())
      setMentionStart(cursor - match[0].length)
    } else {
      setMentionQuery(null)
    }
  }

  function insertMention(displayName: string) {
    const after = value.slice(mentionStart + (mentionQuery?.length ?? 0) + 1)
    const newVal = value.slice(0, mentionStart) + `@${displayName} ` + after
    onChange(newVal)
    setMentionQuery(null)
    setTimeout(() => textareaRef.current?.focus(), 0)
  }

  const suggestions = mentionQuery !== null
    ? members.filter((m) => m.display_name.toLowerCase().includes(mentionQuery))
    : []

  return (
    <div className="relative">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (!value.trim()) return
          onSubmit(value.trim())
        }}
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={(e) => { if (e.key === 'Escape') setMentionQuery(null) }}
          placeholder="Add a comment... Type @ to mention someone"
          rows={2}
          className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
        <button
          type="submit"
          disabled={!value.trim()}
          className="self-end bg-violet-600 text-white text-xs px-3 py-2 rounded-lg hover:bg-violet-700 transition-colors disabled:opacity-40"
        >
          Post
        </button>
      </form>

      {suggestions.length > 0 && (
        <ul className="absolute bottom-full mb-1 left-0 bg-white border border-slate-200 rounded-xl shadow-lg z-10 min-w-48 overflow-hidden">
          {suggestions.map((m) => (
            <li key={m.user_id}>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); insertMention(m.display_name) }}
                className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-violet-50 hover:text-violet-700 transition-colors flex items-center gap-2"
              >
                <span className="w-6 h-6 rounded-full bg-violet-100 text-violet-700 text-xs font-semibold flex items-center justify-center shrink-0">
                  {m.display_name[0].toUpperCase()}
                </span>
                {m.display_name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
