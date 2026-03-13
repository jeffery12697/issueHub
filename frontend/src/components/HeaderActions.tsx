import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import NotificationBell from '@/components/NotificationBell'

export default function HeaderActions() {
  const { logout, user } = useAuthStore()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex items-center gap-1">
      <NotificationBell />
      <button
        onClick={handleLogout}
        title={`Sign out${user ? ` (${user.display_name})` : ''}`}
        className="p-1.5 rounded-md text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
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
