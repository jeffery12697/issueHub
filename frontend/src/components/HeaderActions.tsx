import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import NotificationBell from '@/components/NotificationBell'

export default function HeaderActions() {
  const { logout, user } = useAuthStore()
  const navigate = useNavigate()
  const qc = useQueryClient()

  function handleLogout() {
    logout()
    qc.clear()
    navigate('/login', { replace: true })
  }

  const initials = user?.display_name?.charAt(0).toUpperCase() ?? '?'

  return (
    <div className="flex items-center gap-1">
      <NotificationBell />
      {user && (
        <div className="flex items-center gap-2 pl-1 pr-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-default select-none" title={user.display_name}>
          <div className="w-7 h-7 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center text-sm font-bold shrink-0">
            {initials}
          </div>
          <span className="text-sm text-slate-700 font-medium max-w-[140px] truncate">{user.display_name}</span>
        </div>
      )}
      <button
        onClick={handleLogout}
        title="Sign out"
        className="p-2 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
        aria-label="Sign out"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
      </button>
    </div>
  )
}
