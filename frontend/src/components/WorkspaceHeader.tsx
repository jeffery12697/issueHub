import { Link, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { workspacesApi, useWorkspaceMembers } from '@/api/workspaces'
import { useAuthStore } from '@/store/authStore'
import HeaderActions from '@/components/HeaderActions'
import GlobalSearch from '@/components/GlobalSearch'

const NAV_LINKS = [
  { label: 'Projects', suffix: '' },
  { label: 'My Tasks', suffix: '/my-tasks' },
  { label: 'Workload', suffix: '/workload' },
  { label: 'Analytics', suffix: '/analytics' },
] as const

export default function WorkspaceHeader({ workspaceId }: { workspaceId: string }) {
  const location = useLocation()
  const currentUserId = useAuthStore((s) => s.user?.id)

  const { data: workspace } = useQuery({
    queryKey: ['workspace', workspaceId],
    queryFn: () => workspacesApi.get(workspaceId),
    enabled: !!workspaceId,
  })

  const { data: members = [] } = useWorkspaceMembers(workspaceId)
  const memberMap = Object.fromEntries(members.map((m) => [m.user_id, m]))
  const myRole = currentUserId ? memberMap[currentUserId]?.role : undefined
  const canManageSettings = myRole === 'owner' || myRole === 'admin'

  const basePath = `/workspaces/${workspaceId}`

  return (
    <header className="bg-white border-b border-slate-200 px-6 h-16 flex items-center gap-4">
      <Link to="/" className="text-slate-400 hover:text-slate-600 text-sm transition-colors shrink-0">← Home</Link>
      <span className="text-slate-200 shrink-0">/</span>
      <span className="text-base font-semibold text-slate-800 truncate max-w-[200px]">{workspace?.name}</span>

      <nav className="flex items-center gap-1 ml-2">
        {NAV_LINKS.map(({ label, suffix }) => {
          const href = `${basePath}${suffix}`
          const active = suffix === ''
            ? location.pathname === basePath || location.pathname === basePath + '/'
            : location.pathname.startsWith(href)
          return (
            <Link
              key={suffix}
              to={href}
              className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-violet-50 text-violet-700'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="ml-auto flex items-center gap-2">
        <GlobalSearch workspaceId={workspaceId} />
        {canManageSettings && (
          <Link
            to={`${basePath}/settings`}
            className="p-2 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            title="Workspace settings"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </Link>
        )}
        <HeaderActions />
      </div>
    </header>
  )
}
