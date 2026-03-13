import { useParams } from 'react-router-dom'
import { useAnalytics } from '@/api/workspaces'
import WorkspaceHeader from '@/components/WorkspaceHeader'

export default function AnalyticsPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const { data: analytics, isLoading } = useAnalytics(workspaceId)

  const total = analytics?.total_tasks ?? 0
  const overdue = analytics?.overdue_tasks ?? 0
  const statusCount = (analytics?.tasks_by_status ?? []).length

  return (
    <div className="min-h-screen bg-slate-50">
      <WorkspaceHeader workspaceId={workspaceId!} />

      <main className="max-w-3xl mx-auto py-10 px-6">
        {/* Page title */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>
          <p className="text-sm text-slate-400 mt-1">
            {isLoading ? 'Loading…' : `Overview of all tasks in this workspace`}
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white border border-slate-200 rounded-xl h-24 animate-pulse" />
              ))}
            </div>
            <div className="bg-white border border-slate-200 rounded-xl h-48 animate-pulse" />
          </div>
        ) : (
          <>
            {/* Stat cards */}
            <div className="grid grid-cols-3 gap-4 mb-6">
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
            </div>

            {/* Tasks by status */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
              <h3 className="text-sm font-semibold text-slate-700 mb-5">Tasks by Status</h3>
              {(analytics?.tasks_by_status ?? []).length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-slate-400 text-sm">No tasks with statuses yet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {(analytics?.tasks_by_status ?? [])
                    .sort((a, b) => b.count - a.count)
                    .map((row, i) => {
                      const pct = total > 0 ? Math.round((row.count / total) * 100) : 0
                      return (
                        <div key={i} className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-600 font-medium truncate max-w-[60%]">
                              {row.status_name ?? '(No status)'}
                            </span>
                            <span className="text-slate-400 tabular-nums">
                              {row.count} · {pct}%
                            </span>
                          </div>
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
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
    <div className={`border border-slate-200 rounded-xl shadow-sm p-5 flex flex-col gap-3 ${bgAccent ?? 'bg-white'}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500 font-medium">{label}</span>
        {icon}
      </div>
      <span className={`text-3xl font-bold ${accent ?? 'text-slate-900'}`}>{value}</span>
    </div>
  )
}
