import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import { usePreferences, useUpdatePreferences } from '@/api/auth'
import NotificationBell from '@/components/NotificationBell'
import GlobalSearch from '@/components/GlobalSearch'

export default function HeaderActions() {
  const { logout, user } = useAuthStore()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const { data: prefs } = usePreferences()
  const updatePref = useUpdatePreferences()

  function handleLogout() {
    logout()
    qc.clear()
    navigate('/login', { replace: true })
  }

  const initials = user?.display_name?.charAt(0).toUpperCase() ?? '?'

  return (
    <div className="flex items-center gap-1">
      <GlobalSearch />
      <NotificationBell />

      {user && (
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 pl-1 pr-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer select-none"
            title={user.display_name}
          >
            <div className="w-7 h-7 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center text-sm font-bold shrink-0">
              {initials}
            </div>
            <span className="text-sm text-slate-700 font-medium max-w-[140px] truncate">{user.display_name}</span>
          </button>

          {menuOpen && (
            <>
              {/* backdrop */}
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-1 z-20 w-64 bg-white border border-slate-200 rounded-xl shadow-lg py-2">
                {/* User info */}
                <div className="px-4 py-2 border-b border-slate-100 mb-1">
                  <p className="text-sm font-semibold text-slate-800 truncate">{user.display_name}</p>
                  <p className="text-xs text-slate-400 truncate">{user.email}</p>
                </div>

                {/* Notification preference */}
                <div className="px-4 py-2">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Notifications</p>
                  <div className="flex rounded-lg overflow-hidden border border-slate-200 text-sm">
                    {(['immediate', 'digest'] as const).map((opt) => (
                      <button
                        key={opt}
                        onClick={() => updatePref.mutate(opt)}
                        className={`flex-1 py-1.5 font-medium transition-colors capitalize ${
                          prefs?.notification_preference === opt
                            ? 'bg-violet-600 text-white'
                            : 'bg-white text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-1.5">
                    {prefs?.notification_preference === 'digest'
                      ? "You'll get a daily email summary at 8 AM."
                      : "You'll get emails right away."}
                  </p>
                </div>

                {/* Logout */}
                <div className="border-t border-slate-100 mt-1 pt-1">
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-red-500 transition-colors"
                  >
                    Sign out
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {!user && (
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
      )}
    </div>
  )
}
