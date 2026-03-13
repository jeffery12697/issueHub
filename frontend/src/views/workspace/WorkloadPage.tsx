import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useWorkload } from '@/api/workspaces'
import { useQuery } from '@tanstack/react-query'
import { workspacesApi } from '@/api/workspaces'
import HeaderActions from '@/components/HeaderActions'
import type { Priority } from '@/api/tasks'

const PRIORITY_DOT_COLORS: Record<Priority, string> = {
  none: '#cbd5e1',
  low: '#38bdf8',
  medium: '#fbbf24',
  high: '#f97316',
  urgent: '#ef4444',
}

export default function WorkloadPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>()

  const { data: workspace } = useQuery({
    queryKey: ['workspace', workspaceId],
    queryFn: () => workspacesApi.get(workspaceId!),
    enabled: !!workspaceId,
  })

  const { data: workload = [], isLoading } = useWorkload(workspaceId)

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
        <span className="text-sm font-medium text-slate-800">Workload</span>
        <div className="ml-auto"><HeaderActions /></div>
      </header>

      <main className="max-w-3xl mx-auto py-8 px-6">
        {isLoading ? (
          <p className="text-slate-400 text-sm">Loading…</p>
        ) : workload.length === 0 ? (
          <p className="text-slate-400 text-sm">No members found.</p>
        ) : (
          <div className="space-y-4">
            {workload.map((member) => (
              <MemberCard key={member.user_id} member={member} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

function MemberCard({ member }: { member: { user_id: string; display_name: string; open_task_count: number; tasks: { id: string; title: string; priority: Priority; status_id: string | null }[] } }) {
  const navigate = useNavigate()
  const autoCollapse = member.tasks.length > 5
  const [expanded, setExpanded] = useState(!autoCollapse)

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-slate-50 transition-colors"
      >
        <span className="inline-flex w-9 h-9 rounded-full bg-violet-100 text-violet-700 text-sm font-semibold items-center justify-center shrink-0 select-none">
          {member.display_name[0].toUpperCase()}
        </span>
        <span className="flex-1 text-left font-medium text-slate-800 text-sm">{member.display_name}</span>
        <span className="inline-flex items-center justify-center h-5 px-2 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold">
          {member.open_task_count}
        </span>
        <span className="text-slate-400 text-xs">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && member.tasks.length > 0 && (
        <div className="border-t border-slate-100">
          {member.tasks.map((task, i) => (
            <button
              key={task.id}
              onClick={() => navigate(`/tasks/${task.id}`)}
              className={`w-full text-left px-5 py-3 flex items-center gap-3 hover:bg-violet-50 transition-colors ${i > 0 ? 'border-t border-slate-100' : ''}`}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: PRIORITY_DOT_COLORS[task.priority] }}
              />
              <span className="flex-1 text-sm text-slate-800 truncate">{task.title}</span>
            </button>
          ))}
        </div>
      )}

      {expanded && member.tasks.length === 0 && (
        <div className="border-t border-slate-100 px-5 py-3">
          <p className="text-xs text-slate-400">No tasks assigned.</p>
        </div>
      )}
    </div>
  )
}
