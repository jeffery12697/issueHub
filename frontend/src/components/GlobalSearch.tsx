import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { tasksApi, type Priority } from '@/api/tasks'

const PRIORITY_DOT_COLORS: Record<Priority, string> = {
  none: '#cbd5e1',
  low: '#38bdf8',
  medium: '#fbbf24',
  high: '#f97316',
  urgent: '#ef4444',
}

export default function GlobalSearch({ workspaceId }: { workspaceId: string }) {
  const [inputValue, setInputValue] = useState('')
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const { data: results = [] } = useQuery({
    queryKey: ['search', workspaceId, q],
    queryFn: () => tasksApi.search(workspaceId, q),
    enabled: q.length >= 2,
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
        <div className="absolute z-50 bg-white border border-slate-200 rounded-xl shadow-lg mt-1 max-h-72 overflow-y-auto w-80 right-0">
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
                className="w-full text-left px-4 py-2.5 flex items-center gap-2.5 hover:bg-violet-50 transition-colors border-b border-slate-100 last:border-b-0"
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: PRIORITY_DOT_COLORS[task.priority] }}
                />
                <span className="flex-1 text-sm font-medium text-slate-800 truncate">{task.title}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
