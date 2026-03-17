import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { tasksApi, type Priority } from '@/api/tasks'
import { useUIStore } from '@/store/uiStore'

const HIDE_ON = [/^\/$/, /\/settings$/]

const PRIORITY_DOT_COLORS: Record<Priority, string> = {
  none: '#cbd5e1',
  low: '#38bdf8',
  medium: '#fbbf24',
  high: '#f97316',
  urgent: '#ef4444',
}

export default function GlobalSearch() {
  const workspaceId = useUIStore((s) => s.workspaceId)
  const { pathname } = useLocation()
  if (HIDE_ON.some((re) => re.test(pathname))) return null
  const [inputValue, setInputValue] = useState('')
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const { data: results = [] } = useQuery({
    queryKey: ['search', workspaceId, q],
    queryFn: () => tasksApi.search(workspaceId!, q),
    enabled: !!workspaceId && q.length >= 2,
  })

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setInputValue(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setQ(val)
      setOpen(val.length >= 2)
    }, 300)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      setOpen(false)
      setInputValue('')
      setQ('')
    }
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (!workspaceId) return null

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center gap-1.5 h-8 border border-slate-200 rounded-lg px-2.5 bg-white focus-within:ring-2 focus-within:ring-violet-500 focus-within:border-violet-400 transition-all w-48">
        <span className="text-slate-400 text-xs select-none">🔍</span>
        <input
          type="text"
          value={inputValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Search tasks…"
          className="flex-1 text-xs bg-transparent outline-none text-slate-700 placeholder-slate-400 min-w-0"
        />
      </div>

      {open && q.length >= 2 && (
        <div className="absolute z-50 bg-white border border-slate-200 rounded-xl shadow-lg mt-1 w-96 right-0 overflow-hidden">
          {/* hint */}
          <div className="px-4 py-2 bg-slate-50 border-b border-slate-100">
            <p className="text-[11px] text-slate-400">
              Searches titles, descriptions &amp; comments
            </p>
          </div>

          <div className="max-h-72 overflow-y-auto">
            {results.length === 0 ? (
              <p className="text-xs text-slate-400 px-4 py-3">No results for "{q}"</p>
            ) : (
              results.map((task) => (
                <button
                  key={task.id}
                  onClick={() => {
                    navigate(`/tasks/${task.id}`)
                    setOpen(false)
                    setInputValue('')
                    setQ('')
                  }}
                  className="w-full text-left px-4 py-2.5 flex items-start gap-2.5 hover:bg-violet-50 transition-colors border-b border-slate-100 last:border-b-0"
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0 mt-1.5"
                    style={{ backgroundColor: PRIORITY_DOT_COLORS[task.priority] }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{task.title}</p>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">
                      {[task.project_name, task.list_name].filter(Boolean).join(' › ')}
                    </p>
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
