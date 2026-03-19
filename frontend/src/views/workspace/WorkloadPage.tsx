import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useWorkload } from '@/api/workspaces'
import WorkspaceHeader from '@/components/WorkspaceHeader'
import type { Priority } from '@/api/tasks'
import { PRIORITY_DOT_COLORS } from '@/lib/priority'
import { avatarColor } from '@/lib/avatar'

type WorkloadMember = {
  user_id: string
  display_name: string
  open_task_count: number
  total_story_points: number
  tasks: { id: string; title: string; priority: Priority; status_id: string | null; story_points: number | null }[]
}

export default function WorkloadPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const { data: workload = [], isLoading } = useWorkload(workspaceId)

  const totalTasks = workload.reduce((sum, m) => sum + m.open_task_count, 0)
  const totalSP = workload.reduce((sum, m) => sum + m.total_story_points, 0)

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <WorkspaceHeader workspaceId={workspaceId!} />

      <main className="max-w-3xl mx-auto py-8 sm:py-10 px-4 sm:px-6">
        {/* Page title */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Workload</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {isLoading ? 'Loading…' : workload.length === 0
              ? 'No members found'
              : `${workload.length} member${workload.length === 1 ? '' : 's'} · ${totalTasks} open task${totalTasks === 1 ? '' : 's'}${totalSP > 0 ? ` · ${totalSP} SP` : ''}`}
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl h-16 animate-pulse" />
            ))}
          </div>
        ) : workload.length === 0 ? (
          <div className="text-center py-20 bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
            <div className="w-12 h-12 bg-violet-50 dark:bg-violet-950 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-violet-400">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <p className="text-slate-700 dark:text-slate-300 font-medium mb-1">No members yet</p>
            <p className="text-slate-500 dark:text-slate-400 text-sm">Invite members to your workspace to see workload.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {workload.map((member) => (
              <MemberCard key={member.user_id} member={member} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

function MemberCard({ member }: { member: WorkloadMember }) {
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState(member.tasks.length <= 5)
  const [avatarBg, avatarText] = avatarColor(member.display_name)

  const taskLoad =
    member.open_task_count === 0 ? 'No tasks' :
    member.open_task_count === 1 ? '1 task' :
    `${member.open_task_count} tasks`

  const spLoad = member.total_story_points > 0 ? `${member.total_story_points} SP` : null

  const loadColor =
    member.total_story_points >= 20 ? 'bg-red-100 text-red-600' :
    member.total_story_points >= 10 ? 'bg-amber-100 text-amber-700' :
    member.open_task_count === 0 ? 'bg-slate-100 text-slate-400' :
    'bg-emerald-100 text-emerald-700'

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left"
      >
        <span className={`inline-flex w-9 h-9 rounded-full ${avatarBg} ${avatarText} text-sm font-bold items-center justify-center shrink-0 select-none`}>
          {member.display_name[0].toUpperCase()}
        </span>
        <span className="flex-1 font-medium text-slate-800 dark:text-slate-200 text-sm">{member.display_name}</span>
        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${loadColor}`}>
          {taskLoad}{spLoad ? ` · ${spLoad}` : ''}
        </span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-300 dark:text-slate-600 ml-1 shrink-0 transition-transform" style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }} aria-hidden="true">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {expanded && (
        <div className="border-t border-slate-100 dark:border-slate-800">
          {member.tasks.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400 px-5 py-3">No tasks assigned.</p>
          ) : (
            member.tasks.map((task, i) => (
              <button
                key={task.id}
                onClick={() => navigate(`/tasks/${task.id}`)}
                className={`w-full text-left px-5 py-2.5 flex items-center gap-3 hover:bg-violet-50 dark:hover:bg-violet-950 transition-colors ${i > 0 ? 'border-t border-slate-50 dark:border-slate-800' : ''}`}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: PRIORITY_DOT_COLORS[task.priority] }}
                />
                <span className="flex-1 text-sm text-slate-700 dark:text-slate-300 truncate">{task.title}</span>
                {task.story_points != null && (
                  <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0">{task.story_points} SP</span>
                )}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-300 dark:text-slate-600 shrink-0">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
