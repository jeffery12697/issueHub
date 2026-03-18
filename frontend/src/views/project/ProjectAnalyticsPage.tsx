import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { projectsApi, useProjectAnalytics } from '@/api/projects'
import { workspacesApi } from '@/api/workspaces'
import HeaderActions from '@/components/HeaderActions'

export default function ProjectAnalyticsPage() {
  const { projectId } = useParams<{ projectId: string }>()

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.get(projectId!),
    enabled: !!projectId,
  })

  const { data: workspace } = useQuery({
    queryKey: ['workspace', project?.workspace_id],
    queryFn: () => workspacesApi.get(project!.workspace_id),
    enabled: !!project?.workspace_id,
  })

  const { data: analytics, isLoading } = useProjectAnalytics(projectId)

  const total = analytics?.total_tasks ?? 0
  const overdue = analytics?.overdue_tasks ?? 0
  const totalSP = analytics?.total_story_points ?? 0
  const statusCount = (analytics?.tasks_by_status ?? []).length

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-6 h-16 flex items-center gap-4">
        <Link to="/" className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 text-sm transition-colors shrink-0">← Home</Link>
        {workspace && (
          <>
            <span className="text-slate-200 dark:text-slate-700 shrink-0">/</span>
            <Link
              to={`/workspaces/${workspace.id}`}
              className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-violet-600 bg-slate-100 dark:bg-slate-800 hover:bg-violet-50 dark:hover:bg-violet-950 px-2 py-0.5 rounded-md truncate max-w-[140px] transition-colors"
            >
              {workspace.name}
            </Link>
          </>
        )}
        <span className="text-slate-200 dark:text-slate-700 shrink-0">/</span>
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[160px]">{project?.name}</span>
        <nav className="flex items-center gap-1 ml-2">
          <Link
            to={`/projects/${projectId}`}
            className="px-3.5 py-2 rounded-lg text-sm font-medium transition-colors text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            All Tasks
          </Link>
          <Link
            to={`/projects/${projectId}/epics`}
            className="px-3.5 py-2 rounded-lg text-sm font-medium transition-colors text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Epics
          </Link>
          <Link
            to={`/projects/${projectId}/gantt`}
            className="px-3.5 py-2 rounded-lg text-sm font-medium transition-colors text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Timeline
          </Link>
          <Link
            to={`/projects/${projectId}/analytics`}
            className="px-3.5 py-2 rounded-lg text-sm font-medium transition-colors bg-violet-50 dark:bg-violet-950 text-violet-700 dark:text-violet-300"
          >
            Analytics
          </Link>
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <Link
            to={`/projects/${projectId}/settings`}
            className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 text-sm transition-colors flex items-center gap-1.5"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
            Settings
          </Link>
          <HeaderActions />
        </div>
      </header>

      <main className="max-w-3xl mx-auto py-10 px-6">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Analytics</h1>
          <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
            {isLoading ? 'Loading…' : `Overview of all tasks in ${project?.name ?? 'this project'}`}
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl h-24 animate-pulse" />
              ))}
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl h-48 animate-pulse" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <StatCard
                label="Total Tasks"
                value={total}
                icon={
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-violet-400">
                    <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                  </svg>
                }
              />
              <StatCard
                label="Overdue"
                value={overdue}
                accent={overdue > 0 ? 'text-red-600' : undefined}
                bgAccent={overdue > 0 ? 'bg-red-50' : undefined}
                icon={
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={overdue > 0 ? 'text-red-400' : 'text-slate-300'}>
                    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                }
              />
              <StatCard
                label="Statuses"
                value={statusCount}
                icon={
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-400">
                    <circle cx="12" cy="12" r="2" /><circle cx="12" cy="5" r="1" /><circle cx="12" cy="19" r="1" />
                  </svg>
                }
              />
              <StatCard
                label="Story Points"
                value={totalSP}
                accent="text-violet-600"
                bgAccent="bg-violet-50"
                icon={
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-violet-400">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                }
              />
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm p-6">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Tasks by Status</h3>
              {(analytics?.tasks_by_status ?? []).length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-slate-400 dark:text-slate-500 text-sm">No tasks with statuses yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {(analytics?.tasks_by_status ?? [])
                    .sort((a, b) => b.count - a.count)
                    .map((row, i) => {
                      const pct = total > 0 ? Math.round((row.count / total) * 100) : 0
                      return (
                        <div key={i} className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-600 dark:text-slate-400 font-medium truncate max-w-[60%]">
                              {row.status_name ?? '(No status)'}
                            </span>
                            <span className="text-slate-400 dark:text-slate-500 tabular-nums flex items-center gap-2">
                              {row.count} task{row.count !== 1 ? 's' : ''}
                              {row.story_points > 0 && (
                                <span className="text-violet-500">{row.story_points} SP</span>
                              )}
                              <span>{pct}%</span>
                            </span>
                          </div>
                          <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className="h-2 rounded-full bg-violet-500 transition-all duration-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  )
}

function StatCard({
  label, value, accent, bgAccent, icon,
}: {
  label: string
  value: number
  accent?: string
  bgAccent?: string
  icon: React.ReactNode
}) {
  return (
    <div className={`border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm p-5 flex flex-col gap-3 ${bgAccent ?? 'bg-white dark:bg-slate-900'}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">{label}</span>
        {icon}
      </div>
      <span className={`text-3xl font-bold ${accent ?? 'text-slate-900 dark:text-slate-100'}`}>{value}</span>
    </div>
  )
}
