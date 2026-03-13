import { useParams, Link } from 'react-router-dom'
import { useAnalytics } from '@/api/workspaces'
import { useQuery } from '@tanstack/react-query'
import { workspacesApi } from '@/api/workspaces'
import HeaderActions from '@/components/HeaderActions'

export default function AnalyticsPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>()

  const { data: workspace } = useQuery({
    queryKey: ['workspace', workspaceId],
    queryFn: () => workspacesApi.get(workspaceId!),
    enabled: !!workspaceId,
  })

  const { data: analytics, isLoading } = useAnalytics(workspaceId)

  const total = analytics?.total_tasks ?? 0

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
        <span className="text-sm font-medium text-slate-800">Analytics</span>
        <div className="ml-auto"><HeaderActions /></div>
      </header>

      <main className="max-w-3xl mx-auto py-8 px-6">
        {isLoading ? (
          <p className="text-slate-400 text-sm">Loading…</p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-4 mb-8">
              <StatCard label="Total Tasks" value={analytics?.total_tasks ?? 0} />
              <StatCard
                label="Overdue Tasks"
                value={analytics?.overdue_tasks ?? 0}
                accent={(analytics?.overdue_tasks ?? 0) > 0 ? 'text-red-600' : undefined}
              />
              <StatCard
                label="Statuses Tracked"
                value={(analytics?.tasks_by_status ?? []).length}
              />
            </div>

            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
              <h3 className="text-sm font-semibold text-slate-700 mb-4">Tasks by Status</h3>
              {(analytics?.tasks_by_status ?? []).length === 0 ? (
                <p className="text-slate-400 text-sm">No status data yet.</p>
              ) : (
                <div className="space-y-3">
                  {(analytics?.tasks_by_status ?? []).map((row, i) => {
                    const pct = total > 0 ? Math.round((row.count / total) * 100) : 0
                    return (
                      <div key={i} className="flex items-center gap-3">
                        <span className="text-xs text-slate-600 w-28 shrink-0 truncate">
                          {row.status_name ?? '(No status)'}
                        </span>
                        <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-violet-500 h-2 rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-500 w-8 text-right shrink-0">{row.count}</span>
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

function StatCard({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 flex flex-col gap-1">
      <span className="text-xs text-slate-500 font-medium">{label}</span>
      <span className={`text-3xl font-bold ${accent ?? 'text-slate-900'}`}>{value}</span>
    </div>
  )
}
