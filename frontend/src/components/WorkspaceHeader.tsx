import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { workspacesApi, useWorkspaceMembers } from '@/api/workspaces'
import { useAuthStore } from '@/store/authStore'
import { useUIStore } from '@/store/uiStore'
import HeaderActions from '@/components/HeaderActions'

const NAV_LINKS = [
  { label: 'Projects', suffix: '' },
  { label: 'My Tasks', suffix: '/my-tasks' },
  { label: 'Workload', suffix: '/workload' },
  { label: 'Analytics', suffix: '/analytics' },
  { label: 'Dashboard', suffix: '/dashboard' },
] as const

export default function WorkspaceHeader({ workspaceId }: { workspaceId: string }) {
  const location = useLocation()
  const currentUserId = useAuthStore((s) => s.user?.id)
  const setWorkspaceId = useUIStore((s) => s.setWorkspaceId)

  useEffect(() => { setWorkspaceId(workspaceId) }, [workspaceId, setWorkspaceId])

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

  // Shared nav items — rendered in two slots: inline on sm+, second row on mobile
  const navItems = NAV_LINKS.map(({ label, suffix }) => {
    const href = `${basePath}${suffix}`
    const active = suffix === ''
      ? location.pathname === basePath || location.pathname === basePath + '/'
      : location.pathname.startsWith(href)
    return (
      <Link
        key={suffix}
        to={href}
        className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
          active
            ? 'bg-violet-50 dark:bg-violet-950 text-violet-700 dark:text-violet-300'
            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
        }`}
      >
        {label}
      </Link>
    )
  })

  return (
    <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
      {/* Primary row: breadcrumb + (nav on sm+) + actions */}
      <div className="px-4 sm:px-6 h-14 sm:h-16 flex items-center gap-2 sm:gap-4">
        <Link to="/" className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 text-sm transition-colors shrink-0">← Home</Link>
        <span className="text-slate-200 dark:text-slate-700 shrink-0">/</span>
        <span className="text-sm sm:text-base font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[100px] sm:max-w-[200px]">
          {workspace?.name}
        </span>

        {/* Nav inline — desktop only */}
        <nav className="hidden sm:flex items-center gap-1 ml-2" aria-label="Workspace navigation">
          {navItems}
        </nav>

        <div className="ml-auto flex items-center gap-2 shrink-0">
          {canManageSettings && (
            <Link
              to={`${basePath}/settings`}
              className="p-2 rounded-md text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Workspace settings"
              aria-label="Workspace settings"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </Link>
          )}
          <HeaderActions />
        </div>
      </div>

      {/* Nav second row — mobile only, scrollable */}
      <nav
        className="sm:hidden flex items-center gap-1 px-3 pb-2 overflow-x-auto border-t border-slate-100 dark:border-slate-800"
        aria-label="Workspace navigation"
      >
        {navItems}
      </nav>
    </header>
  )
}
