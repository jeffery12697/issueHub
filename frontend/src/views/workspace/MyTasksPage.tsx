import { useParams, useNavigate, Link } from 'react-router-dom'
import { useMyTasks } from '@/api/tasks'
import HeaderActions from '@/components/HeaderActions'
import { useQuery } from '@tanstack/react-query'
import { workspacesApi } from '@/api/workspaces'

const PRIORITY_COLOR: Record<string, string> = {
  urgent: 'bg-red-100 text-red-700',
  high: 'bg-orange-100 text-orange-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-blue-100 text-blue-700',
  none: 'bg-slate-100 text-slate-500',
}

export default function MyTasksPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const navigate = useNavigate()

  const { data: workspace } = useQuery({
    queryKey: ['workspace', workspaceId],
    queryFn: () => workspacesApi.get(workspaceId!),
    enabled: !!workspaceId,
  })

  const { data: tasks = [], isLoading } = useMyTasks(workspaceId)

  const overdue = tasks.filter((t) => t.due_date && new Date(t.due_date) < new Date())
  const upcoming = tasks.filter((t) => t.due_date && new Date(t.due_date) >= new Date())
  const noDueDate = tasks.filter((t) => !t.due_date)

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 h-14 flex items-center gap-3">
        <Link
          to={`/workspaces/${workspaceId}`}
          className="text-slate-400 hover:text-slate-600 text-sm transition-colors"
        >
          ← {workspace?.name ?? 'Workspace'}
        </Link>
        <span className="text-slate-300">/</span>
        <span className="text-sm font-medium text-slate-800">My Tasks</span>
        <div className="ml-auto"><HeaderActions /></div>
      </header>

      <main className="max-w-3xl mx-auto py-8 px-6">
        {isLoading ? (
          <p className="text-slate-400 text-sm">Loading…</p>
        ) : tasks.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-slate-400 text-sm">No tasks assigned to you yet.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {overdue.length > 0 && (
              <TaskGroup title="Overdue" tasks={overdue} onOpen={(id) => navigate(`/tasks/${id}`)} accent="text-red-600" />
            )}
            {upcoming.length > 0 && (
              <TaskGroup title="Upcoming" tasks={upcoming} onOpen={(id) => navigate(`/tasks/${id}`)} />
            )}
            {noDueDate.length > 0 && (
              <TaskGroup title="No due date" tasks={noDueDate} onOpen={(id) => navigate(`/tasks/${id}`)} />
            )}
          </div>
        )}
      </main>
    </div>
  )
}

function TaskGroup({
  title,
  tasks,
  onOpen,
  accent = 'text-slate-500',
}: {
  title: string
  tasks: { id: string; title: string; priority: string; due_date: string | null; status_id: string | null }[]
  onOpen: (id: string) => void
  accent?: string
}) {
  return (
    <div>
      <h3 className={`text-xs font-semibold uppercase tracking-wider mb-2 ${accent}`}>
        {title} <span className="ml-1 font-normal normal-case tracking-normal text-slate-400">({tasks.length})</span>
      </h3>
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        {tasks.map((task, i) => (
          <button
            key={task.id}
            onClick={() => onOpen(task.id)}
            className={`w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-violet-50 transition-colors ${
              i > 0 ? 'border-t border-slate-100' : ''
            }`}
          >
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize shrink-0 ${PRIORITY_COLOR[task.priority] ?? PRIORITY_COLOR.none}`}
            >
              {task.priority === 'none' ? '—' : task.priority}
            </span>
            <span className="flex-1 text-sm text-slate-800 truncate">{task.title}</span>
            {task.due_date && (
              <span className="text-xs text-slate-400 shrink-0">
                {new Date(task.due_date).toLocaleDateString()}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
