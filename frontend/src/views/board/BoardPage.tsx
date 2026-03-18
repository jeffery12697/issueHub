import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listsApi, type ListStatus } from '@/api/lists'
import { tasksApi, type Task, type Priority } from '@/api/tasks'
import { useWorkspaceMembers, type Member } from '@/api/workspaces'
import { useListSocket } from '@/hooks/useTaskSocket'
import { useAuthStore } from '@/store/authStore'
import { PRIORITY_COLORS } from '@/lib/priority'
import HeaderActions from '@/components/HeaderActions'
import FilterBar, { type FilterRule } from '@/components/FilterBar'
import { useFieldDefinitions } from '@/api/customFields'
import { useWorkspaceTags } from '@/api/tags'

const PRIORITIES: Priority[] = ['none', 'low', 'medium', 'high', 'urgent']

export default function BoardPage() {
  const { projectId, listId } = useParams<{ projectId: string; listId: string }>()
  const qc = useQueryClient()

  useListSocket(listId)

  const { data: list } = useQuery({
    queryKey: ['list', listId],
    queryFn: () => listsApi.get(listId!),
  })

  const [filterRules, setFilterRules] = useState<FilterRule[]>([])
  const [cfFilters, setCfFilters] = useState<Record<string, string>>({})
  const [searchQuery, setSearchQuery] = useState('')
  const [hideCompleted, setHideCompleted] = useState(false)

  const statusEq = filterRules.find((r) => r.field === 'status' && r.op === 'eq')?.value
  const statusNots = filterRules.filter((r) => r.field === 'status' && r.op === 'neq').map((r) => r.value)
  const priorityEq = filterRules.find((r) => r.field === 'priority' && r.op === 'eq')?.value as Priority | undefined
  const priorityNots = filterRules.filter((r) => r.field === 'priority' && r.op === 'neq').map((r) => r.value)
  const tagFilterIds = filterRules.filter((r) => r.field === 'tag' && r.op === 'eq').map((r) => r.value)

  const BOARD_CAP = 100
  const { data: boardResult } = useQuery({
    queryKey: ['tasks', listId, 'board', filterRules, cfFilters],
    queryFn: () => tasksApi.listPaged(listId!, {
      page: 1,
      page_size: BOARD_CAP,
      status_id: statusEq || undefined,
      status_id_not: statusNots.join(',') || undefined,
      priority: priorityEq,
      priority_not: priorityNots.join(',') || undefined,
      tag_ids: tagFilterIds.join(',') || undefined,
      cf: cfFilters,
    }),
  })
  const tasks = boardResult?.items ?? []
  const totalTasks = boardResult?.total ?? 0

  const updateTask = useMutation({
    mutationFn: ({ id, status_id }: { id: string; status_id: string }) =>
      tasksApi.update(id, { status_id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks', listId, 'board'] }),
  })

  const createTask = useMutation({
    mutationFn: ({ title, status_id }: { title: string; status_id: string }) =>
      tasksApi.create(listId!, { title, status_id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks', listId, 'board'] }),
  })

  const isCapped = totalTasks > BOARD_CAP

  const workspaceId = tasks[0]?.workspace_id
  const { data: members = [] } = useWorkspaceMembers(workspaceId)
  const memberMap = Object.fromEntries(members.map((m) => [m.user_id, m]))
  const { data: fieldDefs = [] } = useFieldDefinitions(listId)
  const { data: workspaceTags = [] } = useWorkspaceTags(workspaceId)
  const tagMap = Object.fromEntries(workspaceTags.map((t) => [t.id, t]))

  const currentUserId = useAuthStore((s) => s.user?.id)
  const myRole = currentUserId ? memberMap[currentUserId]?.role : undefined
  const canManageSettings = myRole === 'owner' || myRole === 'admin'

  const statuses = list?.statuses ?? []
  const statusMap = Object.fromEntries(statuses.map((s) => [s.id, s]))

  const visibleTasks = tasks.filter((t) => {
    if (hideCompleted && t.status_id && statusMap[t.status_id]?.is_complete) return false
    if (searchQuery && !t.title.toLowerCase().includes(searchQuery.toLowerCase())) return false
    return true
  })

  const noStatusTasks = visibleTasks.filter((t) => !t.status_id)

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-4 sm:px-6 h-14 sm:h-16 flex items-center gap-3 shrink-0">
        <Link to="/" className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 text-sm transition-colors flex items-center gap-1">
          ← Home
        </Link>
        <span className="text-slate-300 dark:text-slate-600">/</span>
        <span className="text-base font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[120px] sm:max-w-none">{list?.name}</span>
        <div className="ml-auto flex items-center gap-3">
          {canManageSettings && (
            <Link
              to={`/projects/${projectId}/lists/${listId}/settings`}
              className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 text-sm transition-colors flex items-center gap-1.5"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
              Settings
            </Link>
          )}
          <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
            <Link
              to={`/projects/${projectId}/lists/${listId}`}
              className="bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 px-3.5 py-2 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              List
            </Link>
            <span className="bg-violet-600 text-white px-3.5 py-2 text-sm font-medium">
              Board
            </span>
          </div>
          <HeaderActions />
        </div>
      </header>

      {/* Filter bar */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-4 sm:px-6 py-3 space-y-2">
        <FilterBar
          fields={[
            {
              id: 'status',
              label: 'Status',
              options: statuses.map((s) => ({ value: s.id, label: s.name })),
            },
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
          onRulesChange={(rules) => setFilterRules(rules)}
          extra={
            fieldDefs.length > 0 ? (
              <div className="flex items-center gap-2 flex-wrap">
                {fieldDefs.map((field) => {
                  const val = cfFilters[field.id] ?? ''
                  const set = (v: string) => setCfFilters((prev) => { const next = { ...prev }; if (v) next[field.id] = v; else delete next[field.id]; return next })
                  if (field.field_type === 'dropdown' || field.field_type === 'checkbox') {
                    return (
                      <div key={field.id} className="relative">
                        <select
                          value={val}
                          onChange={(e) => set(e.target.value)}
                          className={`h-8 appearance-none pl-3 pr-7 rounded-full text-xs font-medium border cursor-pointer focus:outline-none focus:ring-2 focus:ring-violet-500 transition-colors ${val ? 'border-violet-400 bg-violet-50 dark:bg-violet-950 text-violet-700 dark:text-violet-300' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'}`}
                        >
                          <option value="">{field.name}: All</option>
                          {field.field_type === 'checkbox' ? (
                            <><option value="true">Yes</option><option value="false">No</option></>
                          ) : (
                            (field.options_json ?? []).map((opt: string) => <option key={opt} value={opt}>{opt}</option>)
                          )}
                        </select>
                        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] opacity-60">▾</span>
                      </div>
                    )
                  }
                  return (
                    <input
                      key={field.id}
                      type={field.field_type === 'number' ? 'number' : field.field_type === 'date' ? 'date' : 'text'}
                      value={val}
                      onChange={(e) => set(e.target.value)}
                      placeholder={field.name}
                      className={`h-8 border rounded-full px-3 text-xs focus:outline-none focus:ring-2 focus:ring-violet-500 w-32 transition-colors ${val ? 'border-violet-400 bg-violet-50 dark:bg-violet-950 text-violet-700 dark:text-violet-300' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'}`}
                    />
                  )
                })}
              </div>
            ) : undefined
          }
        />
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tasks…"
              className="pl-8 pr-3 py-1.5 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
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
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
      </div>

      {/* Board */}
      <div className="flex-1 overflow-x-auto flex justify-center">
        <div className="p-6 min-w-max">
        {statuses.length === 0 ? (
          <div className="text-center py-24">
            <p className="text-slate-400 dark:text-slate-500 text-sm">No statuses configured.</p>
            <Link
              to={`/projects/${projectId}/lists/${listId}/settings`}
              className="mt-3 inline-block text-xs text-violet-500 hover:text-violet-700 dark:hover:text-violet-300 transition-colors"
            >
              → Configure statuses in List Settings
            </Link>
          </div>
        ) : (
          <div className="flex gap-4 items-start">
            {/* Unstatused column */}
            {noStatusTasks.length > 0 && (
              <KanbanColumn
                status={{ id: '', name: 'No Status', color: '#cbd5e1', order_index: -1, is_complete: false, category: 'not_started', list_id: listId! }}
                tasks={noStatusTasks}
                memberMap={memberMap}
                statusMap={{}}
                tagMap={tagMap}
                onMoveTask={() => {}}
                onAddTask={null}
              />
            )}

            {statuses.map((status) => (
              <KanbanColumn
                key={status.id}
                status={status}
                tasks={visibleTasks.filter((t) => t.status_id === status.id)}
                memberMap={memberMap}
                statusMap={Object.fromEntries(statuses.map((s) => [s.id, s]))}
                tagMap={tagMap}
                onMoveTask={(taskId) => updateTask.mutate({ id: taskId, status_id: status.id })}
                onAddTask={(title) => createTask.mutate({ title, status_id: status.id })}
              />
            ))}
          </div>
        )}
        {isCapped && (
          <p className="mt-4 text-xs text-slate-400 dark:text-slate-500 text-center">
            Showing first {BOARD_CAP} of {totalTasks} tasks.{' '}
            <Link to={`/projects/${projectId}/lists/${listId}`} className="text-violet-500 hover:text-violet-700 dark:hover:text-violet-300 transition-colors">
              Switch to List view
            </Link>{' '}
            to see all.
          </p>
        )}
        </div>
      </div>
    </div>
  )
}

function KanbanColumn({
  status,
  tasks,
  memberMap,
  statusMap,
  tagMap,
  onMoveTask,
  onAddTask,
}: {
  status: ListStatus
  tasks: Task[]
  memberMap: Record<string, Member>
  statusMap: Record<string, ListStatus>
  tagMap: Record<string, { id: string; name: string; color: string }>
  onMoveTask: (taskId: string) => void
  onAddTask: ((title: string) => void) | null
}) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [addingTask, setAddingTask] = useState(false)
  const [newTitle, setNewTitle] = useState('')

  const totalSP = tasks.reduce((sum, t) => sum + (t.story_points ?? 0), 0)

  function submitAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!newTitle.trim() || !onAddTask) return
    onAddTask(newTitle.trim())
    setNewTitle('')
    setAddingTask(false)
  }

  return (
    <div className="w-72 flex flex-col shrink-0">
      {/* Column header */}
      <div className="mb-3">
        <div
          className="h-1 rounded-t-lg w-full mb-0"
          style={{ backgroundColor: status.color }}
        />
        <div className="bg-white dark:bg-slate-900 rounded-b-lg border border-t-0 border-slate-200 dark:border-slate-700 px-3 py-2.5 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: status.color }} />
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex-1 truncate">{status.name}</span>
          <div className="flex items-center gap-1.5 shrink-0">
            {totalSP > 0 && (
              <span className="text-xs text-violet-500 font-medium">{totalSP} SP</span>
            )}
            <span
              className="text-xs font-semibold px-1.5 py-0.5 rounded-full min-w-[20px] text-center"
              style={{ backgroundColor: status.color + '20', color: status.color }}
            >
              {tasks.length}
            </span>
          </div>
        </div>
      </div>

      {/* Card drop zone */}
      <div
        className={`flex flex-col gap-2.5 min-h-20 rounded-xl p-2 transition-all ${
          isDragOver
            ? 'bg-violet-50 dark:bg-violet-950 ring-2 ring-violet-300 dark:ring-violet-700 ring-offset-1'
            : 'bg-slate-100/50 dark:bg-slate-800/50'
        }`}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragOver(false)
        }}
        onDrop={(e) => {
          e.preventDefault()
          setIsDragOver(false)
          const taskId = e.dataTransfer.getData('taskId')
          if (taskId) onMoveTask(taskId)
        }}
      >
        {tasks.length === 0 && !addingTask && (
          <div className="flex items-center justify-center h-16 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg">
            <p className="text-xs text-slate-300 dark:text-slate-600">Drop tasks here</p>
          </div>
        )}

        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} memberMap={memberMap} statusMap={statusMap} tagMap={tagMap} />
        ))}
      </div>

      {/* Add task */}
      {onAddTask && (
        <div className="mt-2">
          {addingTask ? (
            <form onSubmit={submitAdd} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 shadow-sm space-y-2">
              <input
                autoFocus
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Escape' && setAddingTask(false)}
                placeholder="Task title…"
                className="w-full text-sm border border-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100 dark:placeholder-slate-500 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
              <div className="flex gap-1.5">
                <button
                  type="submit"
                  className="flex-1 bg-violet-600 text-white text-xs py-1.5 rounded-lg hover:bg-violet-700 transition-colors font-medium"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => { setAddingTask(false); setNewTitle('') }}
                  className="px-3 text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setAddingTask(true)}
              className="w-full flex items-center gap-1.5 px-3 py-2 text-xs text-slate-400 dark:text-slate-500 hover:text-violet-600 hover:bg-white dark:hover:bg-slate-900 hover:border hover:border-slate-200 dark:hover:border-slate-700 rounded-xl transition-all group"
            >
              <span className="text-base leading-none group-hover:text-violet-500">+</span>
              Add task
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function TaskCard({ task, memberMap, statusMap, tagMap }: { task: Task; memberMap: Record<string, Member>; statusMap: Record<string, ListStatus>; tagMap: Record<string, { id: string; name: string; color: string }> }) {
  const navigate = useNavigate()
  const today = new Date()
  const dueDate = task.due_date ? new Date(task.due_date) : null
  const isComplete = task.status_id ? (statusMap[task.status_id]?.is_complete ?? false) : false
  // Month is padded (+1 for 0-index) to ensure correct lexicographic date sort
  const fmtDate = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const todayStr = fmtDate(today)
  const dueDateStr = dueDate ? fmtDate(dueDate) : null
  const isOverdue = dueDateStr !== null && !isComplete && dueDateStr < todayStr
  const isDueToday = dueDateStr !== null && !isComplete && dueDateStr === todayStr

  const pColor = PRIORITY_COLORS[task.priority]
  const assignees = task.assignee_ids.map((id) => memberMap[id]).filter(Boolean)

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('taskId', task.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
      onClick={() => navigate(`/tasks/${task.id}`)}
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-3 cursor-pointer shadow-sm hover:shadow-md hover:border-violet-200 dark:hover:border-violet-800 hover:-translate-y-0.5 transition-all group select-none"
    >
      {/* Priority accent bar */}
      {task.priority !== 'none' && (
        <div
          className="h-0.5 rounded-full mb-2.5 w-8"
          style={{ backgroundColor: pColor.dot }}
        />
      )}

      {/* Key + Title */}
      {task.task_key && (
        <span className="text-[10px] font-mono font-semibold text-slate-400 dark:text-slate-500 block mb-0.5">
          {task.task_key}
        </span>
      )}
      <p className="text-sm font-medium text-slate-800 dark:text-slate-200 leading-snug group-hover:text-violet-700 dark:group-hover:text-violet-300 transition-colors mb-1.5">
        {task.title}
      </p>
      {task.tag_ids?.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {task.tag_ids.map((tagId) => {
            const tag = tagMap[tagId]
            if (!tag) return null
            return (
              <span
                key={tagId}
                className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold text-white"
                style={{ background: tag.color }}
              >
                {tag.name}
              </span>
            )
          })}
        </div>
      )}

      {/* Subtask count */}
      {task.subtask_count > 0 && (
        <div className="flex items-center gap-1 mb-2 text-xs text-slate-400 dark:text-slate-500">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="9 18 15 12 9 6" />
          </svg>
          <span>{task.subtask_count} subtask{task.subtask_count === 1 ? '' : 's'}</span>
        </div>
      )}

      {/* Footer row */}
      <div className="flex items-center gap-2 mt-auto">
        {/* Priority badge */}
        {task.priority !== 'none' && (
          <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-full capitalize ${pColor.bg} ${pColor.text}`}>
            {task.priority}
          </span>
        )}

        {/* Story points */}
        {task.story_points != null && (
          <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-violet-50 dark:bg-violet-950 text-violet-500">
            {task.story_points} SP
          </span>
        )}

        <div className="flex-1" />

        {/* Due date */}
        {dueDate && (
          <span className={`inline-flex items-center gap-0.5 text-[11px] font-medium ${
            isOverdue ? 'text-red-500' : isDueToday ? 'text-amber-500' : 'text-slate-400 dark:text-slate-500'
          }`}>
            {isOverdue && (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            )}
            {dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        )}

        {/* Assignee avatars */}
        {assignees.length > 0 && (
          <div className="flex -space-x-1.5">
            {assignees.slice(0, 3).map((m) => (
              <span
                key={m.user_id}
                title={m.display_name}
                className="inline-flex w-5 h-5 rounded-full bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-300 text-[10px] font-bold items-center justify-center border border-white dark:border-slate-900 shrink-0"
              >
                {m.display_name[0].toUpperCase()}
              </span>
            ))}
            {assignees.length > 3 && (
              <span className="inline-flex w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-bold items-center justify-center border border-white dark:border-slate-900 shrink-0">
                +{assignees.length - 3}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
