import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { tasksApi, type Priority } from '@/api/tasks'
import { listsApi } from '@/api/lists'
import { auditApi } from '@/api/audit'
import { dependenciesApi } from '@/api/dependencies'
import { useComments, useCreateComment, useDeleteComment } from '@/api/comments'
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

  if (isLoading) return <div className="flex items-center justify-center h-screen text-gray-400">Loading...</div>
  if (!task) return <div className="flex items-center justify-center h-screen text-gray-400">Task not found</div>

  const statuses = list?.statuses ?? []

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600 text-sm">← Back</button>
        <span className="text-gray-300">/</span>
        <span className="text-sm text-gray-500">Task detail</span>
      </header>

      <main className="max-w-2xl mx-auto py-10 px-6">
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">

          {/* Title */}
          <div>
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
                  className="w-full text-xl font-semibold border-b border-blue-400 outline-none pb-1"
                />
              </form>
            ) : (
              <h1
                className="text-xl font-semibold text-gray-900 cursor-pointer hover:text-blue-600"
                onClick={() => { setTitle(task.title); setEditingTitle(true) }}
              >
                {task.title}
              </h1>
            )}
          </div>

          {/* Status */}
          {statuses.length > 0 && (
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Status</label>
              <div className="flex flex-wrap gap-2 mt-2">
                {statuses.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => updateTask.mutate({ status_id: s.id })}
                    className="text-xs px-3 py-1 rounded-full border transition-colors"
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
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Priority</label>
            <div className="flex gap-2 mt-2">
              {PRIORITIES.map((p) => (
                <button
                  key={p}
                  onClick={() => updateTask.mutate({ priority: p })}
                  className={`text-xs px-3 py-1 rounded-full border capitalize transition-colors ${
                    task.priority === p
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'border-gray-300 text-gray-500 hover:border-gray-400'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Description</label>
            <textarea
              defaultValue={task.description ?? ''}
              onBlur={(e) => updateTask.mutate({ description: e.target.value })}
              placeholder="Add a description..."
              rows={4}
              className="mt-2 w-full text-sm text-gray-700 border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Subtasks */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Subtasks {subtasks.length > 0 && <span className="text-gray-400">({subtasks.length})</span>}
              </label>
              <button
                onClick={() => setAddingSubtask(true)}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                + Add subtask
              </button>
            </div>

            {addingSubtask && (
              <form
                className="flex gap-2 mb-2"
                onSubmit={(e) => { e.preventDefault(); createSubtask.mutate(newSubtaskTitle) }}
              >
                <input
                  autoFocus
                  value={newSubtaskTitle}
                  onChange={(e) => setNewSubtaskTitle(e.target.value)}
                  placeholder="Subtask title"
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button type="submit" className="bg-blue-600 text-white text-xs px-3 py-1.5 rounded-lg">Add</button>
                <button type="button" onClick={() => setAddingSubtask(false)} className="text-xs px-2 text-gray-500">Cancel</button>
              </form>
            )}

            {subtasks.length > 0 && (
              <ul className="space-y-1">
                {subtasks.map((sub) => (
                  <li key={sub.id}>
                    <button
                      onClick={() => navigate(`/tasks/${sub.id}`)}
                      className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-100 hover:border-blue-200 hover:bg-blue-50 text-sm text-gray-700 transition-colors"
                    >
                      <span className="text-gray-300">↳</span>
                      <span className="flex-1">{sub.title}</span>
                      {sub.priority !== 'none' && (
                        <span className="text-xs text-gray-400 capitalize">{sub.priority}</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {subtasks.length === 0 && !addingSubtask && (
              <p className="text-xs text-gray-400">No subtasks yet.</p>
            )}
          </div>

          {/* Dependencies */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Blocked by</label>
              <button
                onClick={() => setAddingBlockedBy(true)}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                + Add
              </button>
            </div>

            {addingBlockedBy && (
              <form
                className="flex gap-2 mb-2"
                onSubmit={(e) => { e.preventDefault(); addBlockedBy.mutate(blockingInput) }}
              >
                <input
                  autoFocus
                  value={blockingInput}
                  onChange={(e) => setBlockingInput(e.target.value)}
                  placeholder="Paste task ID"
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button type="submit" className="bg-blue-600 text-white text-xs px-3 py-1.5 rounded-lg">Add</button>
                <button type="button" onClick={() => setAddingBlockedBy(false)} className="text-xs px-2 text-gray-500">Cancel</button>
              </form>
            )}

            {blockedBy.length > 0 ? (
              <ul className="space-y-1">
                {blockedBy.map((t) => (
                  <li key={t.id} className="flex items-center gap-2 text-sm">
                    <button
                      onClick={() => navigate(`/tasks/${t.id}`)}
                      className="flex-1 text-left px-3 py-1.5 rounded-lg border border-gray-100 hover:border-red-200 hover:bg-red-50 text-gray-700 transition-colors"
                    >
                      <span className="text-red-400 mr-2">⊘</span>{t.title}
                    </button>
                    <button
                      onClick={() => removeBlockedBy.mutate(t.id)}
                      className="text-gray-300 hover:text-red-400 text-xs"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            ) : !addingBlockedBy && (
              <p className="text-xs text-gray-400">No blockers.</p>
            )}

            {blocking.length > 0 && (
              <div className="mt-3">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Blocking</label>
                <ul className="mt-2 space-y-1">
                  {blocking.map((t) => (
                    <li key={t.id}>
                      <button
                        onClick={() => navigate(`/tasks/${t.id}`)}
                        className="w-full text-left px-3 py-1.5 rounded-lg border border-gray-100 hover:border-orange-200 hover:bg-orange-50 text-sm text-gray-700 transition-colors"
                      >
                        <span className="text-orange-400 mr-2">⚡</span>{t.title}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Audit history */}
          {auditLogs.length > 0 && (
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">History</label>
              <ul className="mt-2 space-y-2">
                {auditLogs.map((log) => (
                  <li key={log.id} className="text-xs text-gray-500 flex gap-2">
                    <span className="text-gray-300 shrink-0">
                      {new Date(log.created_at).toLocaleString()}
                    </span>
                    <span>
                      <span className="font-medium capitalize">{log.action}</span>
                      {log.changes && Object.entries(log.changes).map(([field, [oldVal, newVal]]) => (
                        <span key={field} className="ml-1">
                          · {field}: <span className="line-through text-gray-400">{oldVal ?? '—'}</span>
                          {' → '}<span className="text-gray-700">{newVal}</span>
                        </span>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Comments */}
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Comments {comments.length > 0 && <span className="text-gray-400">({comments.length})</span>}
            </label>

            {comments.length > 0 && (
              <ul className="mt-3 space-y-3">
                {comments.map((c) => (
                  <li key={c.id} className="flex gap-3 text-sm">
                    <div className="flex-1 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                      <p className="text-gray-800 whitespace-pre-wrap">{c.body}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(c.created_at).toLocaleString()}
                      </p>
                    </div>
                    {currentUser?.id === c.author_id && (
                      <button
                        onClick={() => deleteComment.mutate(c.id)}
                        className="text-gray-300 hover:text-red-400 text-xs self-start mt-2"
                      >
                        ✕
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                if (!commentBody.trim()) return
                createComment.mutate({ body: commentBody.trim() })
                setCommentBody('')
              }}
            >
              <textarea
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
                placeholder="Add a comment... Use @name to mention someone"
                rows={2}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                disabled={!commentBody.trim()}
                className="self-end bg-blue-600 text-white text-xs px-3 py-2 rounded-lg disabled:opacity-40"
              >
                Post
              </button>
            </form>
          </div>

          {/* Actions */}
          <div className="pt-2 border-t border-gray-100 flex items-center gap-4">
            {task.parent_task_id && (
              <button
                onClick={() => promoteTask.mutate()}
                className="text-sm text-blue-400 hover:text-blue-600"
              >
                ↑ Promote to top-level task
              </button>
            )}
            <button
              onClick={() => deleteTask.mutate()}
              className="text-sm text-red-400 hover:text-red-600"
            >
              Delete task
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
