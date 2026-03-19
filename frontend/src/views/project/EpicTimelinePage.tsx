import { useRef, useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { projectsApi } from '@/api/projects'
import { workspacesApi } from '@/api/workspaces'
import { epicsApi, useEpicTasks } from '@/api/epics'
import { type Task } from '@/api/tasks'
import { useUIStore } from '@/store/uiStore'
import { useThemeContext } from '@/context/ThemeContext'
import HeaderActions from '@/components/HeaderActions'

// ── Layout constants ───────────────────────────────────────────────────────────
const LEFT_W = 280
const ROW_H  = 44
const HDR_H  = 52
const HDR_H_MONTH = 32

// ── Zoom ──────────────────────────────────────────────────────────────────────
type ZoomLevel = 'day' | 'week' | 'month'
const ZOOM_PX: Record<ZoomLevel, number> = { day: 28, week: 14, month: 4 }

// ── Date helpers ──────────────────────────────────────────────────────────────
function dateOnly(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}
function daysBetween(a: Date, b: Date): number {
  return Math.round((dateOnly(b).getTime() - dateOnly(a).getTime()) / 86400000)
}
function parseLocal(s: string): Date {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}

// ── Lighten hex color for bar background ──────────────────────────────────────
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ]
}
function barColors(accentColor: string, isDark: boolean) {
  const [r, g, b] = hexToRgb(accentColor)
  if (isDark) {
    return {
      bg: `rgba(${r},${g},${b},0.15)`,
      border: accentColor,
      text: `rgba(${r},${g},${b},0.9)`,
    }
  }
  return {
    bg: `rgba(${r},${g},${b},0.12)`,
    border: accentColor,
    text: `rgba(${Math.max(0,r-60)},${Math.max(0,g-60)},${Math.max(0,b-60)},1)`,
  }
}

export default function EpicTimelinePage() {
  const { projectId, epicId } = useParams<{ projectId: string; epicId: string }>()
  const navigate = useNavigate()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState<ZoomLevel>('week')
  const { theme } = useThemeContext()
  const isDark = theme === 'dark'

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.get(projectId!),
    enabled: !!projectId,
  })

  const workspaceId = project?.workspace_id
  const setWorkspaceId = useUIStore((s) => s.setWorkspaceId)
  useEffect(() => { if (workspaceId) setWorkspaceId(workspaceId) }, [workspaceId])

  const { data: workspace } = useQuery({
    queryKey: ['workspace', workspaceId],
    queryFn: () => workspacesApi.get(workspaceId!),
    enabled: !!workspaceId,
  })

  const { data: epic } = useQuery({
    queryKey: ['epic', epicId],
    queryFn: () => epicsApi.get(epicId!),
    enabled: !!epicId,
  })

  const { data: epicTasks = [], isLoading } = useEpicTasks(epicId)

  const accentColor = epic?.color ?? '#8b5cf6'
  const pxPerDay = ZOOM_PX[zoom]

  // Partition
  const datedTasks   = epicTasks.filter((t) => t.start_date || t.due_date)
  const undatedTasks = epicTasks.filter((t) => !t.start_date && !t.due_date)

  // Date range
  const today = dateOnly(new Date())
  const allDateMs = epicTasks
    .flatMap((t) => [t.start_date, t.due_date].filter(Boolean) as string[])
    .map((s) => parseLocal(s).getTime())

  // Also include epic's own start/due dates in the range
  if (epic?.start_date) allDateMs.push(parseLocal(epic.start_date).getTime())
  if (epic?.due_date)   allDateMs.push(parseLocal(epic.due_date).getTime())

  const earliest = allDateMs.length ? dateOnly(new Date(Math.min(...allDateMs))) : today
  const latest   = allDateMs.length ? dateOnly(new Date(Math.max(...allDateMs))) : today

  const viewStart = (() => {
    const d = new Date(earliest); d.setDate(d.getDate() - 14); return dateOnly(d)
  })()
  const viewEnd = (() => {
    const d = new Date(latest); d.setDate(d.getDate() + 30)
    const minEnd = new Date(viewStart); minEnd.setDate(minEnd.getDate() + 90)
    return dateOnly(d < minEnd ? minEnd : d)
  })()

  const totalDays   = daysBetween(viewStart, viewEnd) + 1
  const totalPx     = totalDays * pxPerDay
  const todayOffset = daysBetween(viewStart, today)

  // Scroll to today on mount / zoom change
  useEffect(() => {
    if (!scrollRef.current) return
    scrollRef.current.scrollLeft = Math.max(0, (todayOffset - 4) * pxPerDay - LEFT_W / 2)
  }, [zoom, epicId])

  // Month segments
  const monthSegments = (() => {
    const segs: Array<{ label: string; startOff: number; widthDays: number }> = []
    let cur = new Date(viewStart)
    while (cur <= viewEnd) {
      const y = cur.getFullYear(), m = cur.getMonth()
      const monthEnd = new Date(y, m + 1, 0)
      const segEnd   = monthEnd < viewEnd ? monthEnd : viewEnd
      segs.push({
        label:     cur.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        startOff:  daysBetween(viewStart, cur),
        widthDays: daysBetween(cur, segEnd) + 1,
      })
      cur = new Date(y, m + 1, 1)
    }
    return segs
  })()

  const dayTicks = (() => {
    const ticks: Array<{ offset: number; label: string; isWeekStart: boolean }> = []
    if (zoom === 'day') {
      for (let i = 0; i < totalDays; i++) {
        const d = new Date(viewStart); d.setDate(d.getDate() + i)
        ticks.push({ offset: i, label: String(d.getDate()), isWeekStart: d.getDay() === 1 })
      }
    } else if (zoom === 'week') {
      for (let i = 0; i < totalDays; i++) {
        const d = new Date(viewStart); d.setDate(d.getDate() + i)
        if (d.getDay() === 1 || i === 0) {
          ticks.push({
            offset: i,
            label: `${d.getDate()} ${d.toLocaleDateString('en-US', { month: 'short' })}`,
            isWeekStart: true,
          })
        }
      }
    }
    return ticks
  })()

  const hdrH = zoom === 'month' ? HDR_H_MONTH : HDR_H

  // Epic's own row bar (the epic's date span)
  function getEpicBar(): { left: number; width: number } | null {
    const s = epic?.start_date, e = epic?.due_date
    if (!s && !e) return null
    if (s && e) {
      const left  = daysBetween(viewStart, parseLocal(s)) * pxPerDay
      const width = Math.max(pxPerDay, (daysBetween(parseLocal(s), parseLocal(e)) + 1) * pxPerDay)
      return { left, width }
    }
    const anchor = e ?? s!
    return { left: daysBetween(viewStart, parseLocal(anchor)) * pxPerDay, width: pxPerDay * 3 }
  }

  function getTaskBar(task: Task): { left: number; width: number; isMilestone: boolean } | null {
    const { start_date: s, due_date: e } = task
    if (!s && !e) return null
    if (s && e) {
      const left  = daysBetween(viewStart, parseLocal(s)) * pxPerDay
      const width = Math.max(pxPerDay, (daysBetween(parseLocal(s), parseLocal(e)) + 1) * pxPerDay)
      return { left, width, isMilestone: false }
    }
    if (e) return { left: daysBetween(viewStart, parseLocal(e)) * pxPerDay, width: pxPerDay, isMilestone: true }
    return { left: daysBetween(viewStart, parseLocal(s!)) * pxPerDay, width: pxPerDay, isMilestone: false }
  }

  const c = barColors(accentColor, isDark)
  const epicBar = getEpicBar()

  function renderGridLines() {
    return (
      <>
        {dayTicks.filter((t) => t.isWeekStart).map((tick) => (
          <div key={tick.offset} className="absolute top-0 bottom-0 w-px bg-slate-100 dark:bg-slate-800" style={{ left: tick.offset * pxPerDay }} />
        ))}
        {monthSegments.map((seg, i) => i > 0 && (
          <div key={seg.startOff} className="absolute top-0 bottom-0 w-px bg-slate-200 dark:bg-slate-700" style={{ left: seg.startOff * pxPerDay }} />
        ))}
      </>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">

      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 shrink-0">
        <div className="px-4 sm:px-6 h-14 sm:h-16 flex items-center gap-2 sm:gap-3">
          <Link to="/" className="text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-sm transition-colors shrink-0">← Home</Link>
          {workspace && (
            <>
              <span className="text-slate-200 dark:text-slate-700 shrink-0">/</span>
              <Link
                to={`/workspaces/${workspace.id}`}
                className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-violet-600 bg-slate-100 dark:bg-slate-800 hover:bg-violet-50 dark:hover:bg-violet-950 px-2 py-0.5 rounded-md truncate max-w-[70px] sm:max-w-[110px] transition-colors"
              >
                {workspace.name}
              </Link>
            </>
          )}
          <span className="text-slate-200 dark:text-slate-700 shrink-0">/</span>
          <Link
            to={`/projects/${projectId}`}
            className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-violet-600 bg-slate-100 dark:bg-slate-800 hover:bg-violet-50 dark:hover:bg-violet-950 px-2 py-0.5 rounded-md truncate max-w-[70px] sm:max-w-[110px] transition-colors"
          >
            {project?.name}
          </Link>
          <span className="text-slate-200 dark:text-slate-700 hidden sm:block shrink-0">/</span>
          <span className="w-2.5 h-2.5 rounded-full shrink-0 hidden sm:block" style={{ background: accentColor }} />
          <Link
            to={`/projects/${projectId}/epics/${epicId}`}
            className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[100px] sm:max-w-[150px] hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
          >
            {epic?.name ?? '…'}
          </Link>

          {/* Nav inline — desktop only */}
          <nav className="hidden sm:flex items-center gap-1 ml-2" aria-label="Epic navigation">
            <Link
              to={`/projects/${projectId}/epics/${epicId}`}
              className="px-3.5 py-2 rounded-lg text-sm font-medium transition-colors text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Overview
            </Link>
            <Link
              to={`/projects/${projectId}/epics/${epicId}/timeline`}
              className="px-3.5 py-2 rounded-lg text-sm font-medium transition-colors bg-violet-50 dark:bg-violet-950 text-violet-700 dark:text-violet-300"
            >
              Timeline
            </Link>
          </nav>

          <div className="ml-auto flex items-center gap-2 shrink-0">
            <Link
              to={`/projects/${projectId}/settings`}
              className="p-2 rounded-md text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Project settings"
              aria-label="Project settings"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
            </Link>
            <HeaderActions />
          </div>
        </div>

        {/* Nav second row — mobile only */}
        <nav
          className="sm:hidden flex items-center gap-1 px-3 pb-2 overflow-x-auto border-t border-slate-100 dark:border-slate-800"
          aria-label="Epic navigation"
        >
          <Link
            to={`/projects/${projectId}/epics/${epicId}`}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors text-slate-500 dark:text-slate-400 hover:text-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
          >
            Overview
          </Link>
          <Link
            to={`/projects/${projectId}/epics/${epicId}/timeline`}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors bg-violet-50 dark:bg-violet-950 text-violet-700 dark:text-violet-300 whitespace-nowrap"
          >
            Timeline
          </Link>
        </nav>
      </header>

      {/* Toolbar */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-4 sm:px-6 py-3 flex items-center gap-3 shrink-0">
        {/* Zoom */}
        <div className="flex items-center gap-1">
          {(['day', 'week', 'month'] as ZoomLevel[]).map((z) => (
            <button
              key={z}
              onClick={() => setZoom(z)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg capitalize transition-colors ${
                zoom === z
                  ? 'bg-violet-600 text-white'
                  : 'border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              {z}
            </button>
          ))}
        </div>

        {/* Today */}
        <button
          onClick={() => {
            if (!scrollRef.current) return
            scrollRef.current.scrollLeft = Math.max(0, (todayOffset - 4) * pxPerDay - LEFT_W / 2)
          }}
          className="px-3 py-1.5 text-xs font-medium border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
        >
          Today
        </button>

        {/* Legend */}
        <div className="flex items-center gap-3 ml-4">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: c.bg, border: `1.5px solid ${c.border}` }} />
            <span className="text-xs text-slate-500 dark:text-slate-400">Task</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm border border-red-400 dark:border-red-500" style={{ backgroundColor: isDark ? '#450a0a' : '#fef2f2' }} />
            <span className="text-xs text-slate-500 dark:text-slate-400">Overdue</span>
          </div>
          {epicBar && (
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: accentColor + '40', border: `2px solid ${accentColor}` }} />
              <span className="text-xs text-slate-500 dark:text-slate-400">Epic span</span>
            </div>
          )}
        </div>

        <span className="text-xs text-slate-500 dark:text-slate-400 ml-auto">
          {datedTasks.length} task{datedTasks.length !== 1 ? 's' : ''}
          {undatedTasks.length > 0 && (
            <span className="text-slate-300 dark:text-slate-600"> · {undatedTasks.length} hidden (no dates)</span>
          )}
        </span>
      </div>

      {/* Body */}
      {isLoading ? (
        <div className="flex-1 px-6 pt-8">
          <div className="space-y-2 max-w-3xl">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-11 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse" style={{ opacity: 1 - i * 0.15 }} />
            ))}
          </div>
        </div>
      ) : datedTasks.length === 0 && !epicBar ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center py-20">
            <p className="text-slate-700 dark:text-slate-300 font-medium mb-1">
              {epicTasks.length === 0 ? 'No tasks in this epic yet' : 'No tasks with dates'}
            </p>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">
              {epicTasks.length === 0
                ? 'Add tasks to this epic to see them on the timeline.'
                : 'Set start dates or due dates on tasks to see them here.'}
            </p>
            <Link
              to={`/projects/${projectId}/epics/${epicId}`}
              className="text-sm text-violet-600 dark:text-violet-400 hover:underline"
            >
              ← Back to overview
            </Link>
          </div>
        </div>
      ) : (
        <div ref={scrollRef} className="flex-1 overflow-x-auto overflow-y-auto">
          <div style={{ minWidth: LEFT_W + totalPx }}>

            {/* Date header */}
            <div className="flex sticky top-0 z-20 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 shadow-sm" style={{ height: hdrH }}>
              <div className="shrink-0 sticky left-0 z-30 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 flex items-end px-4 pb-2" style={{ width: LEFT_W }}>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Task</span>
              </div>
              <div className="relative select-none" style={{ width: totalPx }}>
                <div className="absolute inset-x-0 top-0" style={{ height: 28 }}>
                  {monthSegments.map((seg, i) => (
                    <div
                      key={i}
                      className="absolute top-0 bottom-0 flex items-center px-2 border-r border-slate-100 dark:border-slate-800"
                      style={{ left: seg.startOff * pxPerDay, width: seg.widthDays * pxPerDay }}
                    >
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 truncate">{seg.label}</span>
                    </div>
                  ))}
                </div>
                {dayTicks.length > 0 && (
                  <div className="absolute inset-x-0 border-t border-slate-100 dark:border-slate-800" style={{ top: 28, bottom: 0 }}>
                    {dayTicks.map((tick, i) => (
                      <div
                        key={i}
                        className="absolute top-0 bottom-0 flex items-center justify-center"
                        style={{ left: tick.offset * pxPerDay, width: zoom === 'day' ? pxPerDay : 7 * pxPerDay }}
                      >
                        <span className={`text-[10px] ${tick.isWeekStart ? 'font-semibold text-slate-500 dark:text-slate-400' : 'text-slate-300 dark:text-slate-600'}`}>
                          {tick.label}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Gantt rows */}
            <div className="relative">

              {/* Today line */}
              {todayOffset >= 0 && todayOffset < totalDays && (
                <div className="absolute top-0 bottom-0 z-10 pointer-events-none" style={{ left: LEFT_W + todayOffset * pxPerDay + Math.floor(pxPerDay / 2) }}>
                  <div className="w-0.5 h-full bg-red-400/60 dark:bg-red-500/50" />
                  <div className="absolute -top-1.5 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-red-400 dark:bg-red-500" style={{ left: 1 }} />
                </div>
              )}

              {/* Epic span row */}
              {epicBar && (
                <div className="flex group" style={{ height: ROW_H + 4, borderBottom: `1px solid ${accentColor}30` }}>
                  {/* Left label */}
                  <div
                    className="shrink-0 sticky left-0 z-10 flex items-center gap-2 px-4 border-r"
                    style={{ width: LEFT_W, backgroundColor: isDark ? `${accentColor}10` : `${accentColor}08`, borderColor: `${accentColor}30` }}
                  >
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: accentColor }} />
                    <span className="text-sm font-semibold truncate" style={{ color: accentColor }}>
                      {epic?.name}
                    </span>
                    <span className="text-[10px] font-medium ml-auto shrink-0 px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${accentColor}20`, color: accentColor }}>
                      Epic
                    </span>
                  </div>
                  {/* Timeline cell */}
                  <div className="relative" style={{ width: totalPx, backgroundColor: isDark ? `${accentColor}06` : `${accentColor}04` }}>
                    {renderGridLines()}
                    <div
                      className="absolute top-1/2 -translate-y-1/2 rounded-md"
                      style={{
                        left: epicBar.left + 2,
                        width: Math.max(epicBar.width - 4, 8),
                        height: 28,
                        backgroundColor: `${accentColor}25`,
                        border: `2px solid ${accentColor}`,
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Task rows */}
              {datedTasks.map((task, rowIdx) => {
                const bar = getTaskBar(task)
                const isOverdue = !!task.due_date && parseLocal(task.due_date) < today
                const isEven = rowIdx % 2 === 0
                return (
                  <div key={task.id} className="flex group" style={{ height: ROW_H }}>
                    {/* Left label */}
                    <div
                      className={`shrink-0 sticky left-0 z-10 flex items-center gap-2 px-4 border-r border-slate-100 dark:border-slate-800 transition-colors ${
                        isEven ? 'bg-white dark:bg-slate-900' : 'bg-slate-50/60 dark:bg-slate-900/60'
                      } group-hover:bg-violet-50/40 dark:group-hover:bg-violet-950/30`}
                      style={{ width: LEFT_W }}
                    >
                      <div className="flex-1 min-w-0">
                        {task.task_key && (
                          <div className="text-[10px] font-mono font-semibold text-slate-300 dark:text-slate-600 leading-none mb-0.5">
                            {task.task_key}
                          </div>
                        )}
                        <button
                          onClick={() => navigate(`/tasks/${task.id}`)}
                          className="text-left text-sm font-medium truncate block w-full text-slate-700 dark:text-slate-300 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
                        >
                          {task.title}
                        </button>
                      </div>
                    </div>

                    {/* Timeline cell */}
                    <div
                      className={`relative transition-colors ${
                        isEven ? 'bg-white dark:bg-slate-900' : 'bg-slate-50/60 dark:bg-slate-900/60'
                      } group-hover:bg-violet-50/20 dark:group-hover:bg-violet-950/20`}
                      style={{ width: totalPx }}
                    >
                      {renderGridLines()}

                      {bar && (
                        <button
                          onClick={() => navigate(`/tasks/${task.id}`)}
                          className="absolute top-1/2 -translate-y-1/2 rounded-md flex items-center px-2 overflow-hidden hover:opacity-90 hover:shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-violet-500"
                          style={{
                            left:   bar.left + 2,
                            width:  Math.max(bar.width - 4, 8),
                            height: 26,
                            backgroundColor: isOverdue ? (isDark ? '#450a0a' : '#fef2f2') : c.bg,
                            border: `1.5px solid ${isOverdue ? (isDark ? '#ef4444' : '#fca5a5') : c.border}`,
                          }}
                          title={task.title}
                        >
                          {bar.width > 48 && (
                            <span
                              className="text-[11px] font-medium truncate leading-none"
                              style={{ color: isOverdue ? (isDark ? '#fca5a5' : '#dc2626') : c.text }}
                            >
                              {task.title}
                            </span>
                          )}
                          {bar.isMilestone && (
                            <svg width="10" height="10" viewBox="0 0 10 10" className="shrink-0" aria-hidden="true">
                              <path d="M5 0 L10 5 L5 10 L0 5 Z" fill={c.border} />
                            </svg>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}

            </div>
          </div>
        </div>
      )}
    </div>
  )
}
