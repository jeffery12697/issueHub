import { useRef, useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { tasksApi, type Task } from '@/api/tasks'
import { listsApi } from '@/api/lists'
import { projectsApi } from '@/api/projects'
import { useThemeContext } from '@/context/ThemeContext'
import ProjectHeader from '@/components/ProjectHeader'

// ── Layout constants ───────────────────────────────────────────────────────────
const LEFT_W = 280   // px — left label panel width
const ROW_H  = 44    // px — row height
const HDR_H  = 52    // px — date header height (month row + tick row)
const HDR_H_MONTH = 32 // px — date header when zoom=month (month row only)

// ── Bar palette (light + dark, indexed by list position) ──────────────────────
const BAR_LIGHT = [
  { bg: '#ede9fe', border: '#8b5cf6', text: '#6d28d9' },
  { bg: '#e0f2fe', border: '#38bdf8', text: '#0369a1' },
  { bg: '#d1fae5', border: '#34d399', text: '#065f46' },
  { bg: '#fef3c7', border: '#fbbf24', text: '#92400e' },
  { bg: '#ffe4e6', border: '#fb7185', text: '#9f1239' },
  { bg: '#e0e7ff', border: '#818cf8', text: '#3730a3' },
]
const BAR_DARK = [
  { bg: '#2e1065', border: '#7c3aed', text: '#c4b5fd' },
  { bg: '#0c4a6e', border: '#0284c7', text: '#7dd3fc' },
  { bg: '#064e3b', border: '#059669', text: '#6ee7b7' },
  { bg: '#78350f', border: '#d97706', text: '#fde68a' },
  { bg: '#4c0519', border: '#e11d48', text: '#fda4af' },
  { bg: '#1e1b4b', border: '#4f46e5', text: '#a5b4fc' },
]

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
/**
 * Parse a date string in local time.
 * Handles both 'YYYY-MM-DD' and 'YYYY-MM-DDTHH:MM:SS...' (backend sends datetime).
 * Slicing to 10 chars gets the date part regardless of the time component.
 */
function parseLocal(s: string): Date {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function ProjectGanttPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState<ZoomLevel>('week')
  const { theme } = useThemeContext()
  const isDark = theme === 'dark'

  // ── Data fetching ──────────────────────────────────────────────────────────
  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.get(projectId!),
    enabled: !!projectId,
  })

  const { data: lists = [] } = useQuery({
    queryKey: ['lists', projectId],
    queryFn: () => listsApi.list(projectId!),
    enabled: !!projectId,
  })

  const { data: result, isLoading } = useQuery({
    queryKey: ['project-tasks-gantt', projectId],
    queryFn: () => tasksApi.listForProject(projectId!, { page: 1, page_size: 500 }),
    enabled: !!projectId,
  })

  const allTasks = result?.items ?? []
  const listColorIdx = Object.fromEntries(lists.map((l, i) => [l.id, i % BAR_LIGHT.length]))
  const listNameMap  = Object.fromEntries(lists.map((l) => [l.id, l.name]))
  const pxPerDay = ZOOM_PX[zoom]
  const palette = isDark ? BAR_DARK : BAR_LIGHT

  // ── Partition tasks ────────────────────────────────────────────────────────
  const datedTasks   = allTasks.filter((t) => t.start_date || t.due_date)
  const undatedTasks = allTasks.filter((t) => !t.start_date && !t.due_date)

  // ── Date range ─────────────────────────────────────────────────────────────
  const today = dateOnly(new Date())
  const allDateMs = allTasks
    .flatMap((t) => [t.start_date, t.due_date].filter(Boolean) as string[])
    .map((s) => parseLocal(s).getTime())

  const earliest = allDateMs.length ? dateOnly(new Date(Math.min(...allDateMs))) : today
  const latest   = allDateMs.length ? dateOnly(new Date(Math.max(...allDateMs))) : today

  const viewStart = (() => {
    const d = new Date(earliest)
    d.setDate(d.getDate() - 14)
    return dateOnly(d)
  })()
  const viewEnd = (() => {
    const d = new Date(latest)
    d.setDate(d.getDate() + 30)
    const minEnd = new Date(viewStart)
    minEnd.setDate(minEnd.getDate() + 90)
    return dateOnly(d < minEnd ? minEnd : d)
  })()

  const totalDays   = daysBetween(viewStart, viewEnd) + 1
  const totalPx     = totalDays * pxPerDay
  const todayOffset = daysBetween(viewStart, today)

  // ── Scroll to today on mount / zoom change ─────────────────────────────────
  useEffect(() => {
    if (!scrollRef.current) return
    scrollRef.current.scrollLeft = Math.max(0, (todayOffset - 4) * pxPerDay - LEFT_W / 2)
  }, [zoom, projectId]) // intentionally omitting pxPerDay/todayOffset to avoid double-run

  // ── Date header segments ───────────────────────────────────────────────────
  const monthSegments = (() => {
    const segs: Array<{ label: string; startOff: number; widthDays: number }> = []
    let cur = new Date(viewStart)
    while (cur <= viewEnd) {
      const y = cur.getFullYear(), m = cur.getMonth()
      const monthEnd = new Date(y, m + 1, 0) // last day of month
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
        const d = new Date(viewStart)
        d.setDate(d.getDate() + i)
        ticks.push({ offset: i, label: String(d.getDate()), isWeekStart: d.getDay() === 1 })
      }
    } else if (zoom === 'week') {
      for (let i = 0; i < totalDays; i++) {
        const d = new Date(viewStart)
        d.setDate(d.getDate() + i)
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

  // ── Bar geometry ───────────────────────────────────────────────────────────
  function getBar(task: Task): { left: number; width: number; isMilestone: boolean } | null {
    const { start_date: s, due_date: e } = task
    if (!s && !e) return null
    if (s && e) {
      const left  = daysBetween(viewStart, parseLocal(s)) * pxPerDay
      const width = Math.max(pxPerDay, (daysBetween(parseLocal(s), parseLocal(e)) + 1) * pxPerDay)
      return { left, width, isMilestone: false }
    }
    if (e) {
      return { left: daysBetween(viewStart, parseLocal(e)) * pxPerDay, width: pxPerDay, isMilestone: true }
    }
    return { left: daysBetween(viewStart, parseLocal(s!)) * pxPerDay, width: pxPerDay, isMilestone: false }
  }

  function taskColors(task: Task) {
    const idx = task.list_id != null ? (listColorIdx[task.list_id] ?? 0) : 0
    return palette[idx]
  }

  // ── Render helpers ─────────────────────────────────────────────────────────
  function renderLeftCell(task: Task, faded: boolean, isEven: boolean) {
    const c = taskColors(task)
    const listName = task.list_id ? listNameMap[task.list_id] : null
    return (
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
            className={`text-left text-sm font-medium truncate block w-full transition-colors hover:text-violet-600 dark:hover:text-violet-400 ${
              faded ? 'text-slate-400 dark:text-slate-500' : 'text-slate-700 dark:text-slate-300'
            }`}
          >
            {task.title}
          </button>
        </div>
        {listName && (
          <span
            className="text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0 max-w-[64px] truncate"
            style={{ backgroundColor: c.bg, color: c.text }}
          >
            {listName}
          </span>
        )}
      </div>
    )
  }

  function renderTimelineCell(task: Task, isEven: boolean, showGridLines: boolean) {
    const bar = getBar(task)
    const c   = taskColors(task)
    const isOverdue = !!task.due_date && parseLocal(task.due_date) < today

    return (
      <div
        className={`relative transition-colors ${
          isEven ? 'bg-white dark:bg-slate-900' : 'bg-slate-50/60 dark:bg-slate-900/60'
        } group-hover:bg-violet-50/20 dark:group-hover:bg-violet-950/20`}
        style={{ width: totalPx }}
      >
        {/* Grid lines */}
        {showGridLines && dayTicks.filter((t) => t.isWeekStart).map((tick) => (
          <div
            key={tick.offset}
            className="absolute top-0 bottom-0 w-px bg-slate-100 dark:bg-slate-800"
            style={{ left: tick.offset * pxPerDay }}
          />
        ))}
        {monthSegments.map((seg, i) => i > 0 && (
          <div
            key={seg.startOff}
            className="absolute top-0 bottom-0 w-px bg-slate-200 dark:bg-slate-700"
            style={{ left: seg.startOff * pxPerDay }}
          />
        ))}

        {/* Task bar */}
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
    )
  }

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">

      <ProjectHeader projectId={projectId!} activeTab="timeline" />

      {/* Toolbar */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-4 sm:px-6 py-3 flex items-center gap-3 shrink-0">
        {/* Zoom controls */}
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

        {/* Scroll to today */}
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
            <div className="w-3 h-3 rounded-sm border border-violet-400 dark:border-violet-500" style={{ backgroundColor: isDark ? '#2e1065' : '#ede9fe' }} />
            <span className="text-xs text-slate-400 dark:text-slate-500">Task bar</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm border border-red-400 dark:border-red-500" style={{ backgroundColor: isDark ? '#450a0a' : '#fef2f2' }} />
            <span className="text-xs text-slate-400 dark:text-slate-500">Overdue</span>
          </div>
          <div className="flex items-center gap-1.5">
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
              <path d="M5 0 L10 5 L5 10 L0 5 Z" fill={isDark ? '#7c3aed' : '#8b5cf6'} />
            </svg>
            <span className="text-xs text-slate-400 dark:text-slate-500">Due date only</span>
          </div>
        </div>

        <span className="text-xs text-slate-400 dark:text-slate-500 ml-auto">
          {datedTasks.length} task{datedTasks.length !== 1 ? 's' : ''}
          {undatedTasks.length > 0 && (
            <span className="text-slate-300 dark:text-slate-600"> · {undatedTasks.length} hidden (no dates)</span>
          )}
        </span>
      </div>

      {/* Gantt body */}
      {isLoading ? (
        <div className="flex-1 px-6 pt-8">
          <div className="space-y-2 max-w-3xl">
            {[...Array(7)].map((_, i) => (
              <div
                key={i}
                className="h-11 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse"
                style={{ opacity: 1 - i * 0.1 }}
              />
            ))}
          </div>
        </div>
      ) : datedTasks.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center py-20">
            <p className="text-slate-700 dark:text-slate-300 font-medium mb-1">
              {allTasks.length === 0 ? 'No tasks yet' : 'No tasks with dates'}
            </p>
            <p className="text-slate-400 dark:text-slate-500 text-sm">
              {allTasks.length === 0
                ? 'Tasks will appear on the timeline once created.'
                : 'Set a start date or due date on tasks to see them here.'}
            </p>
          </div>
        </div>
      ) : (
        /* Scrollable Gantt container */
        <div
          ref={scrollRef}
          className="flex-1 overflow-x-auto overflow-y-auto"
        >
          <div style={{ minWidth: LEFT_W + totalPx }}>

            {/* ── Date header (sticky top) ───────────────────────────────── */}
            <div
              className="flex sticky top-0 z-20 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 shadow-sm"
              style={{ height: hdrH }}
            >
              {/* Left label */}
              <div
                className="shrink-0 sticky left-0 z-30 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 flex items-end px-4 pb-2"
                style={{ width: LEFT_W }}
              >
                <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  Task
                </span>
              </div>

              {/* Timeline header — explicit width so absolutely-positioned labels are never clipped */}
              <div className="relative select-none" style={{ width: totalPx }}>
                {/* Month row */}
                <div className="absolute inset-x-0 top-0" style={{ height: 28 }}>
                  {monthSegments.map((seg, i) => (
                    <div
                      key={i}
                      className="absolute top-0 bottom-0 flex items-center px-2 border-r border-slate-100 dark:border-slate-800"
                      style={{ left: seg.startOff * pxPerDay, width: seg.widthDays * pxPerDay }}
                    >
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 truncate">
                        {seg.label}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Day / week tick row */}
                {dayTicks.length > 0 && (
                  <div
                    className="absolute inset-x-0 border-t border-slate-100 dark:border-slate-800"
                    style={{ top: 28, bottom: 0 }}
                  >
                    {dayTicks.map((tick, i) => (
                      <div
                        key={i}
                        className="absolute top-0 bottom-0 flex items-center justify-center"
                        style={{
                          left: tick.offset * pxPerDay,
                          width: zoom === 'day' ? pxPerDay : 7 * pxPerDay,
                        }}
                      >
                        <span
                          className={`text-[10px] ${
                            tick.isWeekStart
                              ? 'font-semibold text-slate-500 dark:text-slate-400'
                              : 'text-slate-300 dark:text-slate-600'
                          }`}
                        >
                          {tick.label}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── Task rows ─────────────────────────────────────────────── */}
            <div className="relative">

              {/* Today vertical line */}
              {todayOffset >= 0 && todayOffset < totalDays && (
                <div
                  className="absolute top-0 bottom-0 z-10 pointer-events-none"
                  style={{ left: LEFT_W + todayOffset * pxPerDay + Math.floor(pxPerDay / 2) }}
                >
                  <div className="w-0.5 h-full bg-red-400/60 dark:bg-red-500/50" />
                  <div
                    className="absolute -top-1.5 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-red-400 dark:bg-red-500"
                    style={{ left: 1 }}
                  />
                </div>
              )}

              {/* Dated tasks */}
              {datedTasks.map((task, rowIdx) => (
                <div key={task.id} className="flex group" style={{ height: ROW_H }}>
                  {renderLeftCell(task, false, rowIdx % 2 === 0)}
                  {renderTimelineCell(task, rowIdx % 2 === 0, true)}
                </div>
              ))}

            </div>

          </div>
        </div>
      )}
    </div>
  )
}
