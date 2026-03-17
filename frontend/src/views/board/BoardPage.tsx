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

export default function BoardPage() {
  const { projectId, listId } = useParams<{ projectId: string; listId: string }>()
  const qc = useQueryClient()

  useListSocket(listId)

  const { data: list } = useQuery({
    queryKey: ['list', listId],
    queryFn: () => listsApi.get(listId!),
  })

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks', listId],
    queryFn: () => tasksApi.list(listId!),
  })

  const updateTask = useMutation({
    mutationFn: ({ id, status_id }: { id: string; status_id: string }) =>
      tasksApi.update(id, { status_id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks', listId] }),
  })

  const createTask = useMutation({
    mutationFn: ({ title, status_id }: { title: string; status_id: string }) =>
      tasksApi.create(listId!, { title, status_id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks', listId] }),
  })

  const workspaceId = tasks[0]?.workspace_id
  const { data: members = [] } = useWorkspaceMembers(workspaceId)
  const memberMap = Object.fromEntries(members.map((m) => [m.user_id, m]))

  const currentUserId = useAuthStore((s) => s.user?.id)
  const myRole = currentUserId ? memberMap[currentUserId]?.role : undefined
  const canManageSettings = myRole === 'owner' || myRole === 'admin'

  const statuses = list?.statuses ?? []
  const noStatusTasks = tasks.filter((t) => !t.status_id)

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 h-16 flex items-center gap-3 shrink-0">
        <Link to="/" className="text-slate-400 hover:text-slate-600 text-sm transition-colors flex items-center gap-1">
          ← Home
        </Link>
        <span className="text-slate-300">/</span>
        <span className="text-base font-semibold text-slate-800">{list?.name}</span>
        <div className="ml-auto flex items-center gap-3">
          {canManageSettings && (
            <Link
              to={`/projects/${projectId}/lists/${listId}/settings`}
              className="text-slate-400 hover:text-slate-600 text-sm transition-colors flex items-center gap-1.5"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
              Settings
            </Link>
          )}
          <div className="flex rounded-lg border border-slate-200 overflow-hidden">
            <Link
              to={`/projects/${projectId}/lists/${listId}`}
              className="bg-white text-slate-500 px-3.5 py-2 text-sm font-medium hover:bg-slate-50 transition-colors"
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

      {/* Board */}
      <div className="flex-1 overflow-x-auto flex justify-center">
        <div className="p-6 min-w-max">
        {statuses.length === 0 ? (
          <div className="text-center py-24">
            <p className="text-slate-400 text-sm">No statuses configured.</p>
            <Link
              to={`/projects/${projectId}/lists/${listId}/settings`}
              className="mt-3 inline-block text-xs text-violet-500 hover:text-violet-700 transition-colors"
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
                onMoveTask={() => {}}
                onAddTask={null}
              />
            )}

            {statuses.map((status) => (
              <KanbanColumn
                key={status.id}
                status={status}
                tasks={tasks.filter((t) => t.status_id === status.id)}
                memberMap={memberMap}
                statusMap={Object.fromEntries(statuses.map((s) => [s.id, s]))}
                onMoveTask={(taskId) => updateTask.mutate({ id: taskId, status_id: status.id })}
                onAddTask={(title) => createTask.mutate({ title, status_id: status.id })}
              />
            ))}
          </div>
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
  onMoveTask,
  onAddTask,
}: {
  status: ListStatus
  tasks: Task[]
  memberMap: Record<string, Member>
  statusMap: Record<string, ListStatus>
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
        <div className="bg-white rounded-b-lg border border-t-0 border-slate-200 px-3 py-2.5 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: status.color }} />
          <span className="text-sm font-semibold text-slate-700 flex-1 truncate">{status.name}</span>
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
            ? 'bg-violet-50 ring-2 ring-violet-300 ring-offset-1'
            : 'bg-slate-100/50'
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
          <div className="flex items-center justify-center h-16 border-2 border-dashed border-slate-200 rounded-lg">
            <p className="text-xs text-slate-300">Drop tasks here</p>
          </div>
        )}

        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} memberMap={memberMap} statusMap={statusMap} />
        ))}
      </div>

      {/* Add task */}
      {onAddTask && (
        <div className="mt-2">
          {addingTask ? (
            <form onSubmit={submitAdd} className="bg-white border border-slate-200 rounded-xl p-2.5 shadow-sm space-y-2">
              <input
                autoFocus
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Escape' && setAddingTask(false)}
                placeholder="Task title…"
                className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-500"
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
                  className="px-3 text-xs text-slate-400 hover:text-slate-600 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setAddingTask(true)}
              className="w-full flex items-center gap-1.5 px-3 py-2 text-xs text-slate-400 hover:text-violet-600 hover:bg-white hover:border hover:border-slate-200 rounded-xl transition-all group"
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

function TaskCard({ task, memberMap, statusMap }: { task: Task; memberMap: Record<string, Member>; statusMap: Record<string, ListStatus> }) {
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
      className="bg-white border border-slate-200 rounded-xl px-3.5 py-3 cursor-pointer shadow-sm hover:shadow-md hover:border-violet-200 hover:-translate-y-0.5 transition-all group select-none"
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
        <span className="text-[10px] font-mono font-semibold text-slate-400 block mb-0.5">
          {task.task_key}
        </span>
      )}
      <p className="text-sm font-medium text-slate-800 leading-snug group-hover:text-violet-700 transition-colors mb-2.5">
        {task.title}
      </p>

      {/* Subtask count */}
      {task.subtask_count > 0 && (
        <div className="flex items-center gap-1 mb-2 text-xs text-slate-400">
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
          <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-violet-50 text-violet-500">
            {task.story_points} SP
          </span>
        )}

        <div className="flex-1" />

        {/* Due date */}
        {dueDate && (
          <span className={`text-[11px] font-medium ${
            isOverdue ? 'text-red-500' : isDueToday ? 'text-amber-500' : 'text-slate-400'
          }`}>
            {isOverdue && '⚠ '}
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
                className="inline-flex w-5 h-5 rounded-full bg-violet-100 text-violet-700 text-[10px] font-bold items-center justify-center border border-white shrink-0"
              >
                {m.display_name[0].toUpperCase()}
              </span>
            ))}
            {assignees.length > 3 && (
              <span className="inline-flex w-5 h-5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold items-center justify-center border border-white shrink-0">
                +{assignees.length - 3}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
