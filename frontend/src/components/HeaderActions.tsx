import { useRef, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import { usePreferences, useUpdatePreferences } from '@/api/auth'
import { useThemeContext } from '@/context/ThemeContext'
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
  const { theme, toggleTheme } = useThemeContext()

  // Close menu on Escape key
  useEffect(() => {
    if (!menuOpen) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [menuOpen])

  function handleLogout() {
    logout()
    qc.clear()
    navigate('/login', { replace: true })
  }

  const initials = user?.display_name?.charAt(0).toUpperCase() ?? '?'

  return (
    <div className="flex items-center gap-1">
      <GlobalSearch />

      {/* Dark mode toggle */}
      <button
        onClick={toggleTheme}
        className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:text-slate-500 dark:hover:text-slate-300 dark:hover:bg-slate-800 transition-colors"
        aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
      >
        {theme === 'dark' ? (
          // Sun icon
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
          </svg>
        ) : (
          // Moon icon
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
          </svg>
        )}
      </button>

      <NotificationBell />

      {user && (
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 pl-1 pr-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer select-none"
            title={user.display_name}
          >
            <div className="w-7 h-7 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center text-sm font-bold shrink-0">
              {initials}
            </div>
            <span className="text-sm text-slate-700 dark:text-slate-300 font-medium max-w-[140px] truncate hidden sm:inline">{user.display_name}</span>
          </button>

          {menuOpen && (
            <>
              {/* backdrop */}
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-1 z-20 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg py-2">
                {/* User info */}
                <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800 mb-1">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{user.display_name}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 truncate">{user.email}</p>
                </div>

                {/* Notification preference */}
                <div className="px-4 py-2">
                  <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Notifications</p>
                  <div className="flex rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 text-sm">
                    {(['immediate', 'digest'] as const).map((opt) => (
                      <button
                        key={opt}
                        onClick={() => updatePref.mutate(opt)}
                        className={`flex-1 py-1.5 font-medium transition-colors capitalize ${
                          prefs?.notification_preference === opt
                            ? 'bg-violet-600 text-white'
                            : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">
                    {prefs?.notification_preference === 'digest'
                      ? "You'll get a daily email summary at 8 AM."
                      : "You'll get emails right away."}
                  </p>
                </div>

                {/* Logout */}
                <div className="border-t border-slate-100 dark:border-slate-800 mt-1 pt-1">
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-red-500 transition-colors"
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
          className="p-2 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
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
