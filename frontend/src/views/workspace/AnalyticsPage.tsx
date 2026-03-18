import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAnalytics } from '@/api/workspaces'
import { projectsApi, type Project } from '@/api/projects'
import WorkspaceHeader from '@/components/WorkspaceHeader'

export default function AnalyticsPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const [projectId, setProjectId] = useState<string>('')

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['projects', workspaceId],
    queryFn: () => projectsApi.list(workspaceId!),
    enabled: !!workspaceId,
  })

  const { data: analytics, isLoading } = useAnalytics(workspaceId, projectId || undefined)

  const total = analytics?.total_tasks ?? 0
  const overdue = analytics?.overdue_tasks ?? 0
  const totalSP = analytics?.total_story_points ?? 0
  const statusCount = (analytics?.tasks_by_status ?? []).length

  const scopeLabel = projectId
    ? (projects.find((p) => p.id === projectId)?.name ?? 'Project')
    : 'workspace'

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <WorkspaceHeader workspaceId={workspaceId!} />

      <main className="max-w-3xl mx-auto py-10 px-6">
        {/* Page header */}
        <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Analytics</h1>
            <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
              {isLoading ? 'Loading…' : `Overview of all tasks in this ${scopeLabel}`}
            </p>
          </div>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-500 shrink-0"
          >
            <option value="">All projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl h-24 animate-pulse" />
              ))}
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl h-48 animate-pulse" />
          </div>
        ) : (
          <>
            {/* Stat cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
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
                accent={overdue > 0 ? 'text-red-600 dark:text-red-400' : undefined}
                bgAccent={overdue > 0 ? 'bg-red-50 dark:bg-red-950' : undefined}
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
                accent="text-violet-600 dark:text-violet-400"
                bgAccent="bg-violet-50 dark:bg-violet-950"
                icon={
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-violet-400">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                }
              />
            </div>

            {/* Tasks by status */}
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
