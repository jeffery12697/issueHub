import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useMyTasks, type Priority } from '@/api/tasks'
import { projectsApi, type Project } from '@/api/projects'
import { useWorkspaceLists, type List } from '@/api/lists'
import WorkspaceHeader from '@/components/WorkspaceHeader'
import { PRIORITY_COLORS } from '@/lib/priority'

export default function MyTasksPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const navigate = useNavigate()

  const { data: tasks = [], isLoading } = useMyTasks(workspaceId)
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['projects', workspaceId],
    queryFn: () => projectsApi.list(workspaceId!),
    enabled: !!workspaceId,
  })
  const { data: lists = [] } = useWorkspaceLists(workspaceId)

  const projectMap = Object.fromEntries(projects.map((p) => [p.id, p.name]))
  const listMap = Object.fromEntries(lists.map((l: List) => [l.id, l.name]))

  const overdue = tasks.filter((t) => t.due_date && new Date(t.due_date) < new Date())
  const upcoming = tasks.filter((t) => t.due_date && new Date(t.due_date) >= new Date())
  const noDueDate = tasks.filter((t) => !t.due_date)

  return (
    <div className="min-h-screen bg-slate-50">
      <WorkspaceHeader workspaceId={workspaceId!} />

      <main className="max-w-3xl mx-auto py-10 px-6">
        {/* Page title */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">My Tasks</h1>
          <p className="text-sm text-slate-400 mt-1">
            {isLoading ? 'Loading…' : tasks.length === 0
              ? 'No tasks assigned to you yet'
              : `${tasks.length} task${tasks.length === 1 ? '' : 's'} assigned to you`}
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-6">
            {[1, 2].map((i) => (
              <div key={i}>
                <div className="h-3 w-20 bg-slate-200 rounded mb-2 animate-pulse" />
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  {[1, 2, 3].map((j) => (
                    <div key={j} className="h-12 border-b border-slate-100 last:border-0 px-4 flex items-center gap-3">
                      <div className="h-5 w-14 bg-slate-100 rounded-full animate-pulse" />
                      <div className="h-3 flex-1 bg-slate-100 rounded animate-pulse" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-20 bg-white border border-dashed border-slate-200 rounded-2xl">
            <div className="w-12 h-12 bg-violet-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-violet-400">
                <path d="M9 11l3 3L22 4" />
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
              </svg>
            </div>
            <p className="text-slate-700 font-medium mb-1">You're all clear</p>
            <p className="text-slate-400 text-sm">No tasks are assigned to you right now.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {overdue.length > 0 && (
              <TaskGroup title="Overdue" tasks={overdue} onOpen={(id) => navigate(`/tasks/${id}`)} accent="text-red-600" projectMap={projectMap} listMap={listMap} />
            )}
            {upcoming.length > 0 && (
              <TaskGroup title="Upcoming" tasks={upcoming} onOpen={(id) => navigate(`/tasks/${id}`)} projectMap={projectMap} listMap={listMap} />
            )}
            {noDueDate.length > 0 && (
              <TaskGroup title="No due date" tasks={noDueDate} onOpen={(id) => navigate(`/tasks/${id}`)} projectMap={projectMap} listMap={listMap} />
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
  projectMap,
  listMap,
}: {
  title: string
  tasks: { id: string; title: string; priority: string; due_date: string | null; status_id: string | null; project_id: string; list_id: string | null }[]
  onOpen: (id: string) => void
  accent?: string
  projectMap: Record<string, string>
  listMap: Record<string, string>
}) {
  return (
    <div>
      <h3 className={`text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-2 ${accent}`}>
        {title}
        <span className="inline-flex items-center justify-center h-4 px-1.5 rounded-full bg-slate-100 text-slate-500 font-semibold text-[10px] normal-case tracking-normal">
          {tasks.length}
        </span>
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
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize shrink-0 ${(PRIORITY_COLORS[task.priority as Priority] ?? PRIORITY_COLORS.none).bg} ${(PRIORITY_COLORS[task.priority as Priority] ?? PRIORITY_COLORS.none).text}`}>
              {task.priority === 'none' ? '—' : task.priority}
            </span>
            <span className="flex-1 text-sm text-slate-800 truncate">{task.title}</span>
            <span className="flex items-center gap-1 shrink-0">
              {projectMap[task.project_id] && (
                <span className="text-[11px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full truncate max-w-[100px]">
                  {projectMap[task.project_id]}
                </span>
              )}
              {task.list_id && listMap[task.list_id] && (
                <span className="text-[11px] text-violet-500 bg-violet-50 px-2 py-0.5 rounded-full truncate max-w-[100px]">
                  {listMap[task.list_id]}
                </span>
              )}
            </span>
            {task.due_date && (
              <span className="text-xs text-slate-400 shrink-0">
                {new Date(task.due_date).toLocaleDateString('en-US')}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
