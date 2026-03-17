import { useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { tasksApi, type Priority } from '@/api/tasks'
import { listsApi, useWorkspaceLists } from '@/api/lists'
import { useWatchStatus, useWatchTask, useUnwatchTask } from '@/api/watchers'
import { auditApi, type AuditLog } from '@/api/audit'
import { dependenciesApi } from '@/api/dependencies'
import { useComments, useCreateComment, useDeleteComment } from '@/api/comments'
import { useFieldDefinitions, useFieldValues, useUpsertValues, type FieldDefinition, type FieldValue } from '@/api/customFields'
import { useAuthStore } from '@/store/authStore'
import { useTaskSocket } from '@/hooks/useTaskSocket'
import { useWorkspaceMembers, type Member } from '@/api/workspaces'
import { useTaskLinks, useAddLink, useDeleteLink } from '@/api/links'
import { useTimeEntries, useLogTime, useDeleteTimeEntry } from '@/api/timeEntries'
import HeaderActions from '@/components/HeaderActions'
import DeleteButton from '@/components/DeleteButton'
import RichTextEditor from '@/components/RichTextEditor'
import AttachmentList from '@/components/AttachmentList'

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

const PRIORITY_CHIP: Record<Priority, string> = {
  none: 'border-slate-200 text-slate-400',
  low: 'bg-sky-50 border-sky-200 text-sky-700',
  medium: 'bg-amber-50 border-amber-200 text-amber-700',
  high: 'bg-orange-50 border-orange-200 text-orange-700',
  urgent: 'bg-red-50 border-red-200 text-red-700',
}

type DetailTab = 'subtasks' | 'dependencies' | 'links' | 'fields' | 'time'

export default function TaskDetailPage() {
  const { taskId } = useParams<{ taskId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()

  useTaskSocket(taskId)

  const { data: task, isLoading, error } = useQuery({
    queryKey: ['task', taskId],
    queryFn: () => tasksApi.get(taskId!),
    retry: (failureCount, err: any) => {
      const status = err?.response?.status
      if (status === 403 || status === 404) return false
      return failureCount < 2
    },
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

  const [blockerQuery, setBlockerQuery] = useState('')
  const [addingBlockedBy, setAddingBlockedBy] = useState(false)

  const { data: projectTasksForSearch = [] } = useQuery({
    queryKey: ['project-tasks-search', task?.project_id],
    queryFn: () => tasksApi.listForProject(task!.project_id!, { page: 1, page_size: 500 }).then((r) => r.items),
    enabled: !!task?.project_id,
  })

  const addBlockedBy = useMutation({
    mutationFn: (id: string) => dependenciesApi.addBlockedBy(taskId!, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['blocked-by', taskId] }); setBlockerQuery(''); setAddingBlockedBy(false) },
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
  const { data: watchStatus } = useWatchStatus(taskId)
  const watchTask = useWatchTask(taskId!)
  const unwatchTask = useUnwatchTask(taskId!)

  const { data: timeSummary } = useTimeEntries(taskId)
  const logTime = useLogTime(taskId!)
  const deleteTimeEntry = useDeleteTimeEntry(taskId!)

  const [logMinutes, setLogMinutes] = useState('')
  const [logNote, setLogNote] = useState('')
  const [addingTime, setAddingTime] = useState(false)

  const [editingTitle, setEditingTitle] = useState(false)
  const [title, setTitle] = useState('')
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('')
  const [newSubtaskListId, setNewSubtaskListId] = useState('')
  const [addingSubtask, setAddingSubtask] = useState(false)
  const [addingLink, setAddingLink] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [linkTitle, setLinkTitle] = useState('')
  const [commentBody, setCommentBody] = useState('')
  const [activeTab, setActiveTab] = useState<DetailTab>('subtasks')
  const [statusOpen, setStatusOpen] = useState(false)
  const [priorityOpen, setPriorityOpen] = useState(false)

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
    mutationFn: ({ title, list_id }: { title: string; list_id?: string }) =>
      tasksApi.createSubtask(taskId!, { title, list_id: list_id || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subtasks', taskId] })
      setNewSubtaskTitle('')
      setNewSubtaskListId('')
      setAddingSubtask(false)
    },
  })

  if (isLoading) return <LoadingSkeleton />

  const errorStatus = (error as any)?.response?.status
  if (errorStatus === 403) return (
    <div className="flex flex-col items-center justify-center h-screen gap-3">
      <span className="text-4xl">🔒</span>
      <p className="text-slate-700 font-semibold">Access denied</p>
      <p className="text-slate-400 text-sm">You don't have permission to view this task.</p>
      <button onClick={() => navigate(-1)} className="mt-2 text-sm text-violet-600 hover:underline">Go back</button>
    </div>
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
    { key: 'time' as DetailTab, label: 'Time', count: timeSummary?.entries.length },
  ]

  return (
    <div className="min-h-screen bg-slate-50">

      {/* Sticky Header */}
      <header className="bg-white border-b border-slate-200 px-6 h-14 flex items-center gap-3 sticky top-0 z-20 shadow-sm">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 transition-colors shrink-0 text-sm font-medium"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Back
        </button>
        {list && (
          <>
            <span className="text-slate-300">/</span>
            <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md truncate max-w-[140px]">
              {list.name}
            </span>
          </>
        )}
        {task.task_key && (
          <>
            <span className="text-slate-300">/</span>
            <span className="text-xs font-mono font-semibold text-slate-400 shrink-0">{task.task_key}</span>
          </>
        )}
        <span className="text-slate-200 hidden sm:block">/</span>
        <span className="text-sm text-slate-500 truncate min-w-0 hidden sm:block">{task.title}</span>
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
          <div className="flex-1 min-w-0 space-y-5">

            {/* Title + Description card */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
              {task.task_key && (
                <span className="text-[11px] font-mono font-semibold text-slate-400 block mb-1.5 tracking-wide">
                  {task.task_key}
                </span>
              )}
              {editingTitle ? (
                <form onSubmit={(e) => { e.preventDefault(); updateTask.mutate({ title }); setEditingTitle(false) }}>
                  <input
                    autoFocus
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onBlur={() => { updateTask.mutate({ title }); setEditingTitle(false) }}
                    className="w-full text-2xl font-bold border-0 border-b-2 border-violet-400 outline-none pb-1 text-slate-900 bg-transparent mb-5"
                  />
                </form>
              ) : (
                <h1
                  className="text-2xl font-bold text-slate-900 cursor-pointer hover:text-violet-700 transition-colors mb-5 leading-tight group flex items-start gap-2"
                  onClick={() => { setTitle(task.title); setEditingTitle(true) }}
                >
                  <span className="flex-1">{task.title}</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 mt-2 opacity-0 group-hover:opacity-30 transition-opacity">
                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </h1>
              )}
              <RichTextEditor
                key={task.id}
                value={task.description}
                onChange={(html) => {
                  if (html !== (task.description ?? '')) {
                    updateTask.mutate({ description: html || null })
                  }
                }}
              />
              <div className="mt-5 pt-4 border-t border-slate-100">
                <AttachmentList taskId={task.id} />
              </div>
            </div>

            {/* Tabs card */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
              <div className="flex border-b border-slate-100 overflow-x-auto">
                {tabs.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`px-4 py-3 text-sm font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap ${
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
                    {subtasks.length > 0 && (() => {
                      const listMap = Object.fromEntries(workspaceLists.map((l) => [l.id, l.name]))
                      return (
                        <ul className="space-y-0.5 mb-3">
                          {subtasks.map((sub) => (
                            <li key={sub.id}>
                              <button
                                onClick={() => navigate(`/tasks/${sub.id}`)}
                                className="w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-slate-50 text-sm text-slate-700 transition-colors group"
                              >
                                <span className="w-4 h-4 rounded border-2 border-slate-200 group-hover:border-violet-300 shrink-0 transition-colors" />
                                <span className="flex-1">{sub.title}</span>
                                {sub.list_id && sub.list_id !== task.list_id && listMap[sub.list_id] && (
                                  <span className="text-[11px] text-violet-500 bg-violet-50 px-2 py-0.5 rounded-full shrink-0">
                                    {listMap[sub.list_id]}
                                  </span>
                                )}
                                {sub.priority !== 'none' && (
                                  <span className={`text-xs capitalize font-medium shrink-0 ${PRIORITY_COLORS[sub.priority]}`}>
                                    {sub.priority}
                                  </span>
                                )}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )
                    })()}

                    {addingSubtask ? (() => {
                      const projectLists = workspaceLists.filter((l) => l.project_id === task.project_id)
                      return (
                        <form
                          className="space-y-2"
                          onSubmit={(e) => {
                            e.preventDefault()
                            createSubtask.mutate({ title: newSubtaskTitle, list_id: newSubtaskListId || undefined })
                          }}
                        >
                          <div className="flex gap-2">
                            <input
                              autoFocus
                              value={newSubtaskTitle}
                              onChange={(e) => setNewSubtaskTitle(e.target.value)}
                              placeholder="Subtask title"
                              className="flex-1 border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                            />
                            {projectLists.length > 1 && (
                              <select
                                value={newSubtaskListId}
                                onChange={(e) => setNewSubtaskListId(e.target.value)}
                                className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                              >
                                <option value="">Same list</option>
                                {projectLists.filter((l) => l.id !== task.list_id).map((l) => (
                                  <option key={l.id} value={l.id}>{l.name}</option>
                                ))}
                              </select>
                            )}
                            <button type="submit" className="bg-violet-600 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-violet-700 transition-colors">Add</button>
                            <button type="button" onClick={() => { setAddingSubtask(false); setNewSubtaskListId('') }} className="text-xs px-2 text-slate-400 hover:text-slate-600 transition-colors">Cancel</button>
                          </div>
                        </form>
                      )
                    })() : task.depth === 0 ? (
                      <button
                        onClick={() => setAddingSubtask(true)}
                        className="text-sm text-slate-400 hover:text-violet-600 transition-colors flex items-center gap-1.5"
                      >
                        <span className="text-lg leading-none">+</span> Add subtask
                      </button>
                    ) : (
                      <p className="text-xs text-slate-300">Subtasks cannot have subtasks.</p>
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

                      {addingBlockedBy ? (() => {
                        const blockedByIds = new Set(blockedBy.map((t) => t.id))
                        const q = blockerQuery.toLowerCase().trim()
                        const filtered = projectTasksForSearch.filter((t) =>
                          t.id !== taskId &&
                          !blockedByIds.has(t.id) &&
                          (q === '' || t.title.toLowerCase().includes(q) || (t.task_key ?? '').toLowerCase().includes(q))
                        )
                        return (
                          <div className="relative">
                            <div className="flex gap-2">
                              <input
                                autoFocus
                                value={blockerQuery}
                                onChange={(e) => setBlockerQuery(e.target.value)}
                                placeholder="Search by name or task key…"
                                className="flex-1 border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                              />
                              <button type="button" onClick={() => { setAddingBlockedBy(false); setBlockerQuery('') }} className="text-xs px-2 text-slate-400 hover:text-slate-600 transition-colors">Cancel</button>
                            </div>
                            {filtered.length > 0 && (
                              <ul className="absolute z-20 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-52 overflow-y-auto">
                                {filtered.slice(0, 20).map((t) => (
                                  <li key={t.id}>
                                    <button
                                      type="button"
                                      onClick={() => addBlockedBy.mutate(t.id)}
                                      className="w-full text-left px-3 py-2 hover:bg-violet-50 flex items-center gap-2 text-sm transition-colors"
                                    >
                                      {t.task_key && (
                                        <span className="text-[11px] font-mono font-semibold text-slate-400 shrink-0">{t.task_key}</span>
                                      )}
                                      <span className="text-slate-700 truncate">{t.title}</span>
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )
                      })() : (
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
                          <li key={link.id} className="flex items-center gap-2 group px-2 py-1.5 rounded-lg hover:bg-slate-50">
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

                {/* Time Tracking */}
                {activeTab === 'time' && (
                  <div>
                    {timeSummary && timeSummary.total_minutes > 0 && (
                      <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-violet-50 border border-violet-100 rounded-lg">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-violet-500 shrink-0">
                          <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
                        </svg>
                        <p className="text-xs font-medium text-slate-600">
                          Total logged: <span className="text-violet-600 font-semibold">{formatMinutes(timeSummary.total_minutes)}</span>
                        </p>
                      </div>
                    )}

                    {timeSummary && timeSummary.entries.length > 0 && (
                      <ul className="space-y-0.5 mb-3">
                        {timeSummary.entries.map((entry) => (
                          <li key={entry.id} className="flex items-center gap-2 group px-2 py-1.5 rounded-lg hover:bg-slate-50">
                            <span className="text-xs font-semibold text-violet-600 w-12 shrink-0">{formatMinutes(entry.duration_minutes)}</span>
                            <span className="flex-1 text-xs text-slate-500 truncate">{entry.note ?? <span className="text-slate-300">—</span>}</span>
                            <span className="text-xs text-slate-300 shrink-0">{new Date(entry.logged_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                            <button
                              onClick={() => deleteTimeEntry.mutate(entry.id)}
                              className="text-slate-200 hover:text-red-400 text-xs transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                            >✕</button>
                          </li>
                        ))}
                      </ul>
                    )}

                    {addingTime ? (
                      <form
                        className="space-y-2"
                        onSubmit={(e) => {
                          e.preventDefault()
                          const mins = parseInt(logMinutes)
                          if (!mins || mins < 1) return
                          logTime.mutate(
                            { duration_minutes: mins, note: logNote.trim() || undefined },
                            { onSuccess: () => { setLogMinutes(''); setLogNote(''); setAddingTime(false) } }
                          )
                        }}
                      >
                        <div className="flex gap-2 items-center">
                          <input
                            autoFocus
                            type="number"
                            min={1}
                            value={logMinutes}
                            onChange={(e) => setLogMinutes(e.target.value)}
                            placeholder="Minutes"
                            className="w-24 border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                          />
                          <input
                            type="text"
                            value={logNote}
                            onChange={(e) => setLogNote(e.target.value)}
                            placeholder="Note (optional)"
                            className="flex-1 border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button type="submit" className="bg-violet-600 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-violet-700 transition-colors">Log</button>
                          <button type="button" onClick={() => { setAddingTime(false); setLogMinutes(''); setLogNote('') }} className="text-xs px-2 text-slate-400 hover:text-slate-600 transition-colors">Cancel</button>
                        </div>
                      </form>
                    ) : (
                      <button
                        onClick={() => setAddingTime(true)}
                        className="text-sm text-slate-400 hover:text-violet-600 transition-colors flex items-center gap-1.5"
                      >
                        <span className="text-lg leading-none">+</span> Log time
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Comments card */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
              <h3 className="text-sm font-semibold text-slate-700 mb-5 flex items-center gap-2">
                Comments
                {comments.length > 0 && (
                  <span className="text-xs font-normal bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">{comments.length}</span>
                )}
              </h3>

              {comments.length > 0 ? (
                <ul className="space-y-4 mb-6">
                  {comments.map((c) => (
                    <li key={c.id} className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-400 to-violet-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                        {c.author_name?.[0]?.toUpperCase() ?? '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
                          <div className="flex items-baseline gap-2 mb-1.5">
                            <span className="text-sm font-semibold text-slate-800">{c.author_name}</span>
                            <span className="text-xs text-slate-400">
                              {new Date(c.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                            </span>
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
                          <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{c.body}</p>
                        </div>
                        {<div className="mt-2 px-1"><AttachmentList taskId={task.id} commentId={c.id} /></div>}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-center py-8 mb-4">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-2">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-400">
                      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
                    </svg>
                  </div>
                  <p className="text-sm text-slate-400">No comments yet</p>
                </div>
              )}

              <CommentForm
                members={members}
                onSubmit={(body) => createComment.mutate({ body }, { onSuccess: () => setCommentBody('') })}
                value={commentBody}
                onChange={setCommentBody}
              />
            </div>

            {/* History card */}
            {auditLogs.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
                <HistorySection logs={auditLogs} memberMap={memberMap} />
              </div>
            )}
          </div>

          {/* RIGHT — sticky properties sidebar */}
          <div className="w-64 shrink-0 sticky top-20 self-start">
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">

              {/* Status */}
              {statuses.length > 0 && (
                <div className="relative px-4 py-3 border-b border-slate-100">
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Status</p>
                  <button
                    onClick={() => { setStatusOpen((o) => !o); setPriorityOpen(false) }}
                    className="flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-lg border transition-all w-full"
                    style={
                      currentStatus
                        ? { backgroundColor: currentStatus.color + '18', color: currentStatus.color, borderColor: currentStatus.color + '55' }
                        : { borderColor: '#e2e8f0', color: '#94a3b8' }
                    }
                  >
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: currentStatus?.color ?? '#cbd5e1' }} />
                    <span className="flex-1 text-left">{currentStatus?.name ?? 'No status'}</span>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M6 9l6 6 6-6"/>
                    </svg>
                  </button>
                  {statusOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setStatusOpen(false)} />
                      <div className="absolute left-4 right-4 top-full mt-1 z-20 bg-white border border-slate-200 rounded-xl shadow-xl py-1">
                        {statuses.map((s) => (
                          <button
                            key={s.id}
                            onClick={() => { updateTask.mutate({ status_id: s.id }); setStatusOpen(false) }}
                            className="w-full text-left px-3 py-2 flex items-center gap-2.5 hover:bg-slate-50 transition-colors"
                          >
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                            <span className={`text-sm flex-1 ${task.status_id === s.id ? 'font-semibold text-slate-900' : 'text-slate-600'}`}>{s.name}</span>
                            {task.status_id === s.id && (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-violet-600 shrink-0">
                                <polyline points="20 6 9 17 4 12"/>
                              </svg>
                            )}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Priority */}
              <div className="relative px-4 py-3 border-b border-slate-100">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Priority</p>
                <button
                  onClick={() => { setPriorityOpen((o) => !o); setStatusOpen(false) }}
                  className={`flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-lg border transition-all w-full ${PRIORITY_CHIP[task.priority]}`}
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: PRIORITY_DOT[task.priority] }} />
                  <span className="flex-1 text-left capitalize">{task.priority === 'none' ? 'No priority' : task.priority}</span>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M6 9l6 6 6-6"/>
                  </svg>
                </button>
                {priorityOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setPriorityOpen(false)} />
                    <div className="absolute left-4 right-4 top-full mt-1 z-20 bg-white border border-slate-200 rounded-xl shadow-xl py-1">
                      {PRIORITIES.map((p) => (
                        <button
                          key={p}
                          onClick={() => { updateTask.mutate({ priority: p }); setPriorityOpen(false) }}
                          className="w-full text-left px-3 py-2 flex items-center gap-2.5 hover:bg-slate-50 transition-colors"
                        >
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: PRIORITY_DOT[p] }} />
                          <span className={`text-sm flex-1 capitalize ${task.priority === p ? 'font-semibold text-slate-900' : 'text-slate-600'}`}>
                            {p === 'none' ? 'No priority' : p}
                          </span>
                          {task.priority === p && (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-violet-600 shrink-0">
                              <polyline points="20 6 9 17 4 12"/>
                            </svg>
                          )}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Assignees */}
              <div className="px-4 py-3 border-b border-slate-100">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Assignees</p>
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
              <div className="px-4 py-3 border-b border-slate-100">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Reviewer</p>
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

              {/* Dates */}
              <div className="px-4 py-3 border-b border-slate-100 space-y-3">
                <div>
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Start Date</p>
                  <input
                    key={task.start_date ?? 'start-none'}
                    type="date"
                    lang="en"
                    defaultValue={task.start_date ? task.start_date.slice(0, 10) : ''}
                    onChange={(e) => updateTask.mutate({ start_date: e.target.value || undefined })}
                    className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Due Date</p>
                  <input
                    key={task.due_date ?? 'none'}
                    type="date"
                    lang="en"
                    defaultValue={task.due_date ? task.due_date.slice(0, 10) : ''}
                    onChange={(e) => updateTask.mutate({ due_date: e.target.value || undefined })}
                    className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
              </div>

              {/* Story Points */}
              <div className="px-4 py-3 border-b border-slate-100">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Story Points</p>
                <input
                  key={task.story_points ?? 'sp-none'}
                  type="number"
                  min={0}
                  defaultValue={task.story_points ?? ''}
                  onBlur={(e) => {
                    const val = e.target.value ? parseInt(e.target.value) : null
                    if (val !== task.story_points) updateTask.mutate({ story_points: val })
                  }}
                  placeholder="—"
                  className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>

              {/* Move to List */}
              {workspaceLists.length > 1 && (
                <div className="px-4 py-3 border-b border-slate-100">
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Move to List</p>
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

              {/* Watch */}
              <div className="px-4 py-3">
                {watchStatus?.watching ? (
                  <button
                    onClick={() => unwatchTask.mutate()}
                    className="w-full flex items-center justify-center gap-2 text-xs font-medium text-violet-600 bg-violet-50 border border-violet-200 hover:bg-violet-100 px-3 py-2 rounded-lg transition-colors"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                    </svg>
                    Watching
                  </button>
                ) : (
                  <button
                    onClick={() => watchTask.mutate()}
                    className="w-full flex items-center justify-center gap-2 text-xs font-medium text-slate-500 bg-white border border-slate-200 hover:border-violet-300 hover:text-violet-600 hover:bg-violet-50 px-3 py-2 rounded-lg transition-colors"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                    Watch
                  </button>
                )}
              </div>

            </div>
          </div>

        </div>
      </main>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200 h-14 shadow-sm" />
      <div className="max-w-6xl mx-auto py-8 px-6">
        <div className="flex gap-8">
          <div className="flex-1 space-y-5">
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <div className="h-7 bg-slate-100 rounded-lg animate-pulse w-1/2" />
              <div className="space-y-2.5 mt-2">
                <div className="h-4 bg-slate-100 rounded animate-pulse" />
                <div className="h-4 bg-slate-100 rounded animate-pulse w-4/5" />
                <div className="h-4 bg-slate-100 rounded animate-pulse w-3/5" />
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl h-48 animate-pulse" />
            <div className="bg-white border border-slate-200 rounded-xl h-32 animate-pulse" />
          </div>
          <div className="w-64 shrink-0">
            <div className="bg-white border border-slate-200 rounded-xl h-[480px] animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  )
}

function formatMinutes(mins: number): string {
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
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
          <input type="date" lang="en" defaultValue={currentVal as string ?? ''} onChange={(e) => onSave(e.target.value || null)}
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

function resolveName(id: string | null | undefined, memberMap: Record<string, Member>): string {
  if (!id) return '—'
  return memberMap[id]?.display_name ?? id
}

const ACTION_DOT: Record<string, string> = {
  created: 'bg-emerald-400',
  updated: 'bg-blue-400',
  time_logged: 'bg-violet-400',
  attachment_added: 'bg-amber-400',
  attachment_removed: 'bg-red-300',
  comment_created: 'bg-sky-400',
  link_added: 'bg-teal-400',
  link_removed: 'bg-red-300',
}

function HistorySection({ logs, memberMap }: { logs: AuditLog[]; memberMap: Record<string, Member> }) {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? logs : logs.slice(0, 5)

  function renderValue(field: string, id: string | null | undefined): string {
    if (field === 'reviewer_id') return resolveName(id, memberMap)
    return id ?? '—'
  }

  function renderChange(field: string, val: unknown) {
    if (field === 'assignee_ids') {
      const [oldIds, newIds] = val as [string[], string[]]
      const oldNames = oldIds.map((id) => resolveName(id, memberMap)).join(', ') || '—'
      const newNames = newIds.map((id) => resolveName(id, memberMap)).join(', ') || '—'
      return <span>assignees: <span className="line-through text-slate-400">{oldNames}</span> → <span className="text-slate-600">{newNames}</span></span>
    }
    const [oldVal, newVal] = val as [string, string?]
    if (newVal === undefined) {
      return <span>{field}: <span className="text-slate-500">edited</span></span>
    }
    return <span>{field.replace(/_id$/, '')}: <span className="line-through text-slate-400">{renderValue(field, oldVal) ?? '—'}</span> → <span className="text-slate-600">{renderValue(field, newVal)}</span></span>
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-700 mb-4">History</h3>
      <ul className="space-y-3">
        {visible.map((log) => (
          <li key={log.id} className="flex gap-3 text-xs">
            <div className="flex flex-col items-center shrink-0 pt-0.5">
              <span className={`w-2 h-2 rounded-full shrink-0 ${ACTION_DOT[log.action] ?? 'bg-slate-300'}`} />
            </div>
            <div className="flex-1 min-w-0">
              <span className="font-semibold text-slate-700">{log.actor_name ?? 'Git'}</span>{' '}
              <span className="text-slate-500 capitalize">{log.action.replace(/_/g, ' ')}</span>
              {log.action === 'time_logged' && log.changes && (
                <div className="text-slate-400 mt-0.5">
                  {log.changes.duration_minutes} min
                  {log.changes.note ? ` — ${log.changes.note}` : ''}
                </div>
              )}
              {log.changes && !['link_added', 'link_removed', 'attachment_added', 'attachment_removed', 'time_logged'].includes(log.action) &&
                Object.entries(log.changes).map(([field, val]) => (
                  <div key={field} className="text-slate-400 mt-0.5">
                    {renderChange(field, val)}
                  </div>
                ))
              }
              <div className="text-slate-300 mt-0.5">{new Date(log.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</div>
            </div>
          </li>
        ))}
      </ul>
      {logs.length > 5 && (
        <button onClick={() => setExpanded((v) => !v)} className="mt-3 text-xs text-slate-400 hover:text-violet-600 transition-colors flex items-center gap-1">
          {expanded
            ? <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 15l-6-6-6 6"/></svg> Show less</>
            : <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 9l6 6 6-6"/></svg> {logs.length - 5} more</>
          }
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
      <form onSubmit={(e) => { e.preventDefault(); if (!value.trim()) return; onSubmit(value.trim()) }}>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={(e) => { if (e.key === 'Escape') setMentionQuery(null) }}
          placeholder="Write a comment… use @ to mention someone"
          rows={3}
          className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500 transition-shadow"
        />
        {value.trim() && (
          <div className="flex justify-end gap-2 mt-2">
            <button
              type="button"
              onClick={() => onChange('')}
              className="text-xs text-slate-400 hover:text-slate-600 px-3 py-1.5 transition-colors"
            >
              Clear
            </button>
            <button
              type="submit"
              className="bg-violet-600 text-white text-xs px-4 py-2 rounded-lg hover:bg-violet-700 transition-colors font-medium"
            >
              Post comment
            </button>
          </div>
        )}
      </form>
    </div>
  )
}
