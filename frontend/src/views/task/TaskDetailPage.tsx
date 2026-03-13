import { useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { tasksApi, type Priority } from '@/api/tasks'
import { listsApi, useWorkspaceLists } from '@/api/lists'
import { auditApi, type AuditLog } from '@/api/audit'
import { dependenciesApi } from '@/api/dependencies'
import { useComments, useCreateComment, useDeleteComment } from '@/api/comments'
import { useFieldDefinitions, useFieldValues, useUpsertValues, type FieldDefinition, type FieldValue } from '@/api/customFields'
import { useAuthStore } from '@/store/authStore'
import { useTaskSocket } from '@/hooks/useTaskSocket'
import { useWorkspaceMembers, type Member } from '@/api/workspaces'
import { useTaskLinks, useAddLink, useDeleteLink } from '@/api/links'
import HeaderActions from '@/components/HeaderActions'
import DeleteButton from '@/components/DeleteButton'

const PRIORITIES: Priority[] = ['none', 'low', 'medium', 'high', 'urgent']

const PRIORITY_COLORS: Record<Priority, string> = {
  none: 'text-slate-400',
  low: 'text-sky-500',
  medium: 'text-amber-500',
  high: 'text-orange-500',
  urgent: 'text-red-500',
}

const PRIORITY_DOT: Record<Priority, string> = {
  none: '#cbd5e1',
  low: '#38bdf8',
  medium: '#fbbf24',
  high: '#f97316',
  urgent: '#ef4444',
}

type DetailTab = 'subtasks' | 'dependencies' | 'links' | 'fields'

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
    mutationFn: (id: string) => dependenciesApi.addBlockedBy(taskId!, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['blocked-by', taskId] }); setBlockingInput('') },
  })

  const removeBlockedBy = useMutation({
    mutationFn: (id: string) => dependenciesApi.removeBlockedBy(taskId!, id),
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
  const { data: workspaceLists = [] } = useWorkspaceLists(task?.workspace_id)

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
  const [activeTab, setActiveTab] = useState<DetailTab>('subtasks')

  const updateTask = useMutation({
    mutationFn: (data: Parameters<typeof tasksApi.update>[1]) => tasksApi.update(taskId!, data),
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
      if (task?.list_id) qc.invalidateQueries({ queryKey: ['tasks', task.list_id] })
      navigate(-1)
    },
  })

  const moveTask = useMutation({
    mutationFn: (listId: string) => tasksApi.move(taskId!, listId),
    onSuccess: (moved) => {
      qc.invalidateQueries({ queryKey: ['task', taskId] })
      if (task?.list_id) qc.invalidateQueries({ queryKey: ['tasks', task.list_id] })
      if (moved.list_id) qc.invalidateQueries({ queryKey: ['tasks', moved.list_id] })
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

  if (isLoading) return (
    <div className="flex items-center justify-center h-screen text-slate-400 text-sm">Loading…</div>
  )
  if (!task) return (
    <div className="flex items-center justify-center h-screen text-slate-400 text-sm">Task not found</div>
  )

  const statuses = list?.statuses ?? []
  const currentStatus = statuses.find((s) => s.id === task.status_id)
  const memberMap = Object.fromEntries(members.map((m) => [m.user_id, m]))

  const tabs: { key: DetailTab; label: string; count?: number }[] = [
    { key: 'subtasks', label: 'Subtasks', count: subtasks.length },
    { key: 'dependencies', label: 'Blocked by', count: blockedBy.length + blocking.length },
    { key: 'links', label: 'Links', count: links.length },
    ...(fieldDefs.length > 0 ? [{ key: 'fields' as DetailTab, label: 'Fields' }] : []),
  ]

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 h-14 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="text-slate-400 hover:text-slate-600 text-sm flex items-center gap-1.5 transition-colors shrink-0"
        >
          ← Back
        </button>
        <span className="text-slate-200">|</span>
        <span className="text-sm text-slate-500 truncate min-w-0">{task.title}</span>
        <div className="ml-auto flex items-center gap-2 shrink-0">
          {task.parent_task_id && (
            <button
              onClick={() => promoteTask.mutate()}
              className="text-xs text-violet-500 hover:text-violet-700 border border-violet-200 hover:border-violet-400 px-3 py-1.5 rounded-lg transition-colors font-medium"
            >
              ↑ Promote
            </button>
          )}
          <DeleteButton
            variant="button"
            message={`Delete "${task.title}"? All subtasks and comments will be removed.`}
            onConfirm={() => deleteTask.mutate()}
          />
          <HeaderActions />
        </div>
      </header>

      <main className="max-w-6xl mx-auto py-8 px-6">
        <div className="flex gap-8 items-start">

          {/* LEFT — main content */}
          <div className="flex-1 min-w-0 space-y-6">

            {/* Title + Description */}
            <div>
              {editingTitle ? (
                <form onSubmit={(e) => { e.preventDefault(); updateTask.mutate({ title }); setEditingTitle(false) }}>
                  <input
                    autoFocus
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onBlur={() => { updateTask.mutate({ title }); setEditingTitle(false) }}
                    className="w-full text-2xl font-bold border-0 border-b-2 border-violet-400 outline-none pb-1 text-slate-900 bg-transparent mb-4"
                  />
                </form>
              ) : (
                <h1
                  className="text-2xl font-bold text-slate-900 cursor-pointer hover:text-violet-600 transition-colors mb-4 leading-tight"
                  onClick={() => { setTitle(task.title); setEditingTitle(true) }}
                >
                  {task.title}
                </h1>
              )}
              <textarea
                key={task.description ?? ''}
                defaultValue={task.description ?? ''}
                onBlur={(e) => {
                  if (e.target.value !== (task.description ?? '')) {
                    updateTask.mutate({ description: e.target.value })
                  }
                }}
                placeholder="Add a description…"
                rows={4}
                className="w-full text-sm text-slate-600 placeholder-slate-400 bg-white border border-slate-200 rounded-xl px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent leading-relaxed hover:border-slate-300 transition-colors"
              />
            </div>

            {/* Tabs */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <div className="flex border-b border-slate-100">
                {tabs.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`px-4 py-3 text-sm font-medium transition-colors flex items-center gap-1.5 ${
                      activeTab === tab.key
                        ? 'text-violet-600 border-b-2 border-violet-600 -mb-px'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {tab.label}
                    {tab.count !== undefined && tab.count > 0 && (
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-normal ${
                        activeTab === tab.key ? 'bg-violet-100 text-violet-600' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {tab.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              <div className="p-4">
                {/* Subtasks */}
                {activeTab === 'subtasks' && (
                  <div>
                    {subtasks.length > 0 && (
                      <ul className="space-y-1 mb-3">
                        {subtasks.map((sub) => (
                          <li key={sub.id}>
                            <button
                              onClick={() => navigate(`/tasks/${sub.id}`)}
                              className="w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-slate-50 text-sm text-slate-700 transition-colors group"
                            >
                              <span className="w-4 h-4 rounded border-2 border-slate-200 group-hover:border-violet-300 shrink-0 transition-colors" />
                              <span className="flex-1">{sub.title}</span>
                              {sub.priority !== 'none' && (
                                <span className={`text-xs capitalize font-medium ${PRIORITY_COLORS[sub.priority]}`}>
                                  {sub.priority}
                                </span>
                              )}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}

                    {addingSubtask ? (
                      <form
                        className="flex gap-2"
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
                        <button type="button" onClick={() => setAddingSubtask(false)} className="text-xs px-2 text-slate-400 hover:text-slate-600 transition-colors">Cancel</button>
                      </form>
                    ) : (
                      <button
                        onClick={() => setAddingSubtask(true)}
                        className="text-sm text-slate-400 hover:text-violet-600 transition-colors flex items-center gap-1.5"
                      >
                        <span className="text-lg leading-none">+</span> Add subtask
                      </button>
                    )}
                  </div>
                )}

                {/* Dependencies */}
                {activeTab === 'dependencies' && (
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Blocked by</p>
                      {blockedBy.length > 0 ? (
                        <ul className="space-y-1 mb-2">
                          {blockedBy.map((t) => (
                            <li key={t.id} className="flex items-center gap-2">
                              <button
                                onClick={() => navigate(`/tasks/${t.id}`)}
                                className="flex-1 text-left px-3 py-1.5 rounded-lg hover:bg-red-50 text-sm text-slate-700 transition-colors flex items-center gap-2"
                              >
                                <span className="text-red-400 text-xs">⊘</span>{t.title}
                              </button>
                              <button onClick={() => removeBlockedBy.mutate(t.id)} className="text-slate-300 hover:text-red-400 text-xs transition-colors px-1">✕</button>
                            </li>
                          ))}
                        </ul>
                      ) : !addingBlockedBy && <p className="text-sm text-slate-400 mb-2">No blockers.</p>}

                      {addingBlockedBy ? (
                        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); addBlockedBy.mutate(blockingInput) }}>
                          <input
                            autoFocus
                            value={blockingInput}
                            onChange={(e) => setBlockingInput(e.target.value)}
                            placeholder="Paste task ID"
                            className="flex-1 border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                          />
                          <button type="submit" className="bg-violet-600 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-violet-700 transition-colors">Add</button>
                          <button type="button" onClick={() => setAddingBlockedBy(false)} className="text-xs px-2 text-slate-400 hover:text-slate-600 transition-colors">Cancel</button>
                        </form>
                      ) : (
                        <button onClick={() => setAddingBlockedBy(true)} className="text-sm text-slate-400 hover:text-violet-600 transition-colors flex items-center gap-1.5">
                          <span className="text-lg leading-none">+</span> Add blocker
                        </button>
                      )}
                    </div>

                    {blocking.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Blocking</p>
                        <ul className="space-y-1">
                          {blocking.map((t) => (
                            <li key={t.id}>
                              <button
                                onClick={() => navigate(`/tasks/${t.id}`)}
                                className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-orange-50 text-sm text-slate-700 transition-colors flex items-center gap-2"
                              >
                                <span className="text-orange-400 text-xs">⚡</span>{t.title}
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* Links */}
                {activeTab === 'links' && (
                  <div>
                    {links.length > 0 && (
                      <ul className="space-y-1 mb-3">
                        {links.map((link) => (
                          <li key={link.id} className="flex items-center gap-2 group">
                            <span className="text-slate-300 text-xs shrink-0">🔗</span>
                            <a
                              href={link.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 text-sm text-violet-600 hover:underline truncate"
                            >
                              {link.title || link.url}
                            </a>
                            <button
                              onClick={() => deleteLink.mutate(link.id)}
                              className="text-slate-200 hover:text-red-400 text-xs transition-colors opacity-0 group-hover:opacity-100"
                            >
                              ✕
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}

                    {addingLink ? (
                      <form
                        className="space-y-2"
                        onSubmit={(e) => {
                          e.preventDefault()
                          if (!linkUrl.trim()) return
                          addLink.mutate(
                            { url: linkUrl.trim(), title: linkTitle.trim() || undefined },
                            { onSuccess: () => { setLinkUrl(''); setLinkTitle(''); setAddingLink(false) } }
                          )
                        }}
                      >
                        <input autoFocus type="url" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)}
                          placeholder="URL" className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                        <input type="text" value={linkTitle} onChange={(e) => setLinkTitle(e.target.value)}
                          placeholder="Title (optional)" className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                        <div className="flex gap-2">
                          <button type="submit" className="bg-violet-600 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-violet-700 transition-colors">Add</button>
                          <button type="button" onClick={() => { setAddingLink(false); setLinkUrl(''); setLinkTitle('') }} className="text-xs px-2 text-slate-400 hover:text-slate-600 transition-colors">Cancel</button>
                        </div>
                      </form>
                    ) : (
                      <button onClick={() => setAddingLink(true)} className="text-sm text-slate-400 hover:text-violet-600 transition-colors flex items-center gap-1.5">
                        <span className="text-lg leading-none">+</span> Add link
                      </button>
                    )}
                  </div>
                )}

                {/* Custom Fields */}
                {activeTab === 'fields' && (
                  <div className="space-y-3">
                    {fieldDefs.map((field) => {
                      const valueMap = Object.fromEntries(fieldValues.map((v) => [v.field_id, v]))
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
                )}
              </div>
            </div>

            {/* Comments */}
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-3">
                Comments
                {comments.length > 0 && (
                  <span className="ml-2 text-xs font-normal text-slate-400">{comments.length}</span>
                )}
              </h3>

              {comments.length > 0 && (
                <ul className="space-y-3 mb-4">
                  {comments.map((c) => (
                    <li key={c.id} className="flex gap-3">
                      <div className="w-7 h-7 rounded-full bg-violet-100 text-violet-700 text-xs font-semibold flex items-center justify-center shrink-0 mt-0.5">
                        {c.author_name?.[0]?.toUpperCase() ?? '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 mb-1">
                          <span className="text-sm font-medium text-slate-800">{c.author_name}</span>
                          <span className="text-xs text-slate-400">{new Date(c.created_at).toLocaleString('en-US')}</span>
                          {currentUser?.id === c.author_id && (
                            <span className="ml-auto">
                              <DeleteButton
                                variant="text"
                                message="Delete this comment? This cannot be undone."
                                onConfirm={() => deleteComment.mutate(c.id)}
                              />
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-700 whitespace-pre-wrap">{c.body}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <CommentForm
                members={members}
                onSubmit={(body) => createComment.mutate({ body }, { onSuccess: () => setCommentBody('') })}
                value={commentBody}
                onChange={setCommentBody}
              />
            </div>

            {/* History */}
            {auditLogs.length > 0 && <HistorySection logs={auditLogs} />}
          </div>

          {/* RIGHT — properties sidebar */}
          <div className="w-64 shrink-0">
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm divide-y divide-slate-100">

              {/* Status */}
              {statuses.length > 0 && (
                <div className="px-4 py-3">
                  <p className="text-xs font-medium text-slate-400 mb-2">Status</p>
                  <div className="flex flex-wrap gap-1.5">
                    {statuses.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => updateTask.mutate({ status_id: s.id })}
                        className="text-xs px-2.5 py-1 rounded-full border font-medium transition-all"
                        style={
                          task.status_id === s.id
                            ? { backgroundColor: s.color + '20', color: s.color, borderColor: s.color + '60' }
                            : { borderColor: '#e2e8f0', color: '#94a3b8' }
                        }
                      >
                        {s.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Priority */}
              <div className="px-4 py-3">
                <p className="text-xs font-medium text-slate-400 mb-2">Priority</p>
                <div className="flex flex-wrap gap-1.5">
                  {PRIORITIES.map((p) => (
                    <button
                      key={p}
                      onClick={() => updateTask.mutate({ priority: p })}
                      className={`text-xs px-2.5 py-1 rounded-full border font-medium capitalize transition-all flex items-center gap-1 ${
                        task.priority === p
                          ? 'border-slate-300 bg-slate-900 text-white'
                          : 'border-slate-200 text-slate-500 hover:border-slate-300'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: PRIORITY_DOT[p] }} />
                      {p === 'none' ? '—' : p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Assignees */}
              <div className="px-4 py-3">
                <p className="text-xs font-medium text-slate-400 mb-2">Assignees</p>
                {task.assignee_ids.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {task.assignee_ids.map((id) => {
                      const m = memberMap[id]
                      return (
                        <span key={id} className="flex items-center gap-1 bg-slate-50 border border-slate-200 text-slate-700 text-xs px-2 py-1 rounded-full">
                          <span className="w-4 h-4 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center text-[10px] font-bold shrink-0">
                            {(m?.display_name ?? '?')[0].toUpperCase()}
                          </span>
                          {m?.display_name ?? id.slice(0, 6)}
                          <button
                            onClick={() => updateTask.mutate({ assignee_ids: task.assignee_ids.filter((a) => a !== id) })}
                            className="text-slate-300 hover:text-red-400 transition-colors leading-none ml-0.5"
                          >×</button>
                        </span>
                      )
                    })}
                  </div>
                )}
                <select
                  value=""
                  onChange={(e) => {
                    if (!e.target.value || task.assignee_ids.includes(e.target.value)) return
                    updateTask.mutate({ assignee_ids: [...task.assignee_ids, e.target.value] })
                  }}
                  className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white"
                >
                  <option value="">+ Add assignee…</option>
                  {members.filter((m) => !task.assignee_ids.includes(m.user_id)).map((m) => (
                    <option key={m.user_id} value={m.user_id}>{m.display_name}</option>
                  ))}
                </select>
              </div>

              {/* Reviewer */}
              <div className="px-4 py-3">
                <p className="text-xs font-medium text-slate-400 mb-2">Reviewer</p>
                {task.reviewer_id && memberMap[task.reviewer_id] ? (
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs text-slate-700">
                      <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-[10px] font-bold shrink-0">
                        {memberMap[task.reviewer_id].display_name[0].toUpperCase()}
                      </span>
                      {memberMap[task.reviewer_id].display_name}
                    </span>
                    <button onClick={() => updateTask.mutate({ reviewer_id: null })} className="text-xs text-slate-300 hover:text-red-400 transition-colors">✕</button>
                  </div>
                ) : (
                  <select
                    value=""
                    onChange={(e) => { if (e.target.value) updateTask.mutate({ reviewer_id: e.target.value }) }}
                    className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white"
                  >
                    <option value="">Assign reviewer…</option>
                    {members.map((m) => <option key={m.user_id} value={m.user_id}>{m.display_name}</option>)}
                  </select>
                )}
              </div>

              {/* Due Date */}
              <div className="px-4 py-3">
                <p className="text-xs font-medium text-slate-400 mb-2">Due Date</p>
                <input
                  key={task.due_date ?? 'none'}
                  type="date"
                  defaultValue={task.due_date ? task.due_date.slice(0, 10) : ''}
                  onChange={(e) => updateTask.mutate({ due_date: e.target.value || undefined })}
                  className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>

              {/* Move to List */}
              {workspaceLists.length > 1 && (
                <div className="px-4 py-3">
                  <p className="text-xs font-medium text-slate-400 mb-2">Move to List</p>
                  <select
                    value=""
                    onChange={(e) => { if (e.target.value) moveTask.mutate(e.target.value) }}
                    className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white"
                  >
                    <option value="">Move to…</option>
                    {workspaceLists.filter((l) => l.id !== task.list_id).map((l) => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                </div>
              )}

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
    <div className="flex items-center gap-3">
      <label className="text-sm text-slate-500 w-28 shrink-0">
        {field.name}{field.is_required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      <div className="flex-1">
        {field.field_type === 'checkbox' && (
          <input type="checkbox" checked={!!currentVal} onChange={(e) => onSave(e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 text-violet-600" />
        )}
        {(field.field_type === 'text' || field.field_type === 'url') && (
          <input type={field.field_type === 'url' ? 'url' : 'text'} defaultValue={currentVal as string ?? ''}
            onBlur={(e) => onSave(e.target.value || null)} placeholder="—"
            className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
        )}
        {field.field_type === 'number' && (
          <input type="number" defaultValue={currentVal as number ?? ''}
            onBlur={(e) => onSave(e.target.value ? Number(e.target.value) : null)} placeholder="—"
            className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
        )}
        {field.field_type === 'date' && (
          <input type="date" defaultValue={currentVal as string ?? ''} onChange={(e) => onSave(e.target.value || null)}
            className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
        )}
        {field.field_type === 'dropdown' && (
          <select value={(currentVal as string) ?? ''} onChange={(e) => onSave(e.target.value ? { selected: e.target.value } : null)}
            className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
            <option value="">—</option>
            {(field.options_json ?? []).map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        )}
      </div>
    </div>
  )
}

function HistorySection({ logs }: { logs: AuditLog[] }) {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? logs : logs.slice(0, 5)

  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-700 mb-3">History</h3>
      <ul className="space-y-3">
        {visible.map((log) => (
          <li key={log.id} className="flex gap-3 text-xs">
            <div className="w-1.5 h-1.5 rounded-full bg-slate-300 mt-1.5 shrink-0" />
            <div>
              <span className="font-medium text-slate-700">{log.actor_name}</span>{' '}
              <span className="text-slate-500 capitalize">{log.action.replace(/_/g, ' ')}</span>
              {log.changes && !['link_added', 'link_removed'].includes(log.action) &&
                Object.entries(log.changes).map(([field, [oldVal, newVal]]) => (
                  <div key={field} className="text-slate-400 mt-0.5">
                    {field}: <span className="line-through">{oldVal ?? '—'}</span> → <span className="text-slate-600">{newVal as string}</span>
                  </div>
                ))
              }
              <div className="text-slate-300 mt-0.5">{new Date(log.created_at).toLocaleString('en-US')}</div>
            </div>
          </li>
        ))}
      </ul>
      {logs.length > 5 && (
        <button onClick={() => setExpanded((v) => !v)} className="mt-2 text-xs text-slate-400 hover:text-violet-600 transition-colors">
          {expanded ? '↑ Show less' : `↓ ${logs.length - 5} more`}
        </button>
      )}
    </div>
  )
}

function CommentForm({ members, onSubmit, value, onChange }: {
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
    const match = val.slice(0, cursor).match(/@(\w*)$/)
    if (match) { setMentionQuery(match[1].toLowerCase()); setMentionStart(cursor - match[0].length) }
    else setMentionQuery(null)
  }

  function insertMention(displayName: string) {
    const after = value.slice(mentionStart + (mentionQuery?.length ?? 0) + 1)
    onChange(value.slice(0, mentionStart) + `@${displayName} ` + after)
    setMentionQuery(null)
    setTimeout(() => textareaRef.current?.focus(), 0)
  }

  const suggestions = mentionQuery !== null
    ? members.filter((m) => m.display_name.toLowerCase().includes(mentionQuery))
    : []

  return (
    <div className="relative">
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (!value.trim()) return; onSubmit(value.trim()) }}>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={(e) => { if (e.key === 'Escape') setMentionQuery(null) }}
          placeholder="Write a comment… @ to mention"
          rows={2}
          className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
        <button
          type="submit"
          disabled={!value.trim()}
          className="self-end bg-violet-600 text-white text-xs px-4 py-2 rounded-lg hover:bg-violet-700 transition-colors disabled:opacity-40 font-medium"
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
                className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-violet-50 transition-colors flex items-center gap-2"
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
