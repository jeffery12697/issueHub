import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  useNotifications,
  useUnreadCount,
  useMarkRead,
  useMarkAllRead,
  type Notification,
} from '@/api/notifications'

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const firstItemRef = useRef<HTMLButtonElement>(null)
  const navigate = useNavigate()

  const { data: unreadData } = useUnreadCount()
  const { data: notifications = [] } = useNotifications()
  const markRead = useMarkRead()
  const markAllRead = useMarkAllRead()

  const unreadCount = unreadData?.count ?? 0
  const recent = notifications.slice(0, 20)

  // Move focus into dropdown when it opens
  useEffect(() => {
    if (open) {
      firstItemRef.current?.focus()
    }
  }, [open])

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  // Close on Escape key — restore focus to trigger
  useEffect(() => {
    if (!open) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false)
        requestAnimationFrame(() => triggerRef.current?.focus())
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open])

  function handleNotificationClick(notif: Notification) {
    if (!notif.is_read) {
      markRead.mutate(notif.id)
    }
    setOpen(false)
    navigate(`/tasks/${notif.task_id}`)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        ref={triggerRef}
        onClick={() => setOpen(o => !o)}
        aria-label={unreadCount > 0 ? `Notifications — ${unreadCount} unread` : 'Notifications'}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="relative p-1.5 rounded-md text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none" aria-hidden="true">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 top-9 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg z-50 overflow-hidden"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllRead.mutate()}
                className="text-xs text-violet-600 hover:text-violet-800 font-medium transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {recent.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-slate-400 dark:text-slate-500">
                No notifications yet
              </div>
            ) : (
              recent.map((notif, idx) => (
                <button
                  key={notif.id}
                  ref={idx === 0 ? firstItemRef : undefined}
                  onClick={() => handleNotificationClick(notif)}
                  className={`w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-b border-slate-50 dark:border-slate-800 last:border-0 ${
                    notif.is_read ? 'opacity-60' : ''
                  }`}
                >
                  <span
                    className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${
                      notif.is_read ? 'bg-slate-200 dark:bg-slate-700' : 'bg-violet-500'
                    }`}
                    aria-hidden="true"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-700 dark:text-slate-300 leading-snug line-clamp-3">{notif.body}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{relativeTime(notif.created_at)}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
