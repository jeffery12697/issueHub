import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import WorkspaceHeader from '@/components/WorkspaceHeader'
import { useAuthStore } from '@/store/authStore'
import { useWorkspaceMembers } from '@/api/workspaces'
import { projectsApi, type Project } from '@/api/projects'
import {
  useDashboardWidgets,
  useWidgetData,
  useCreateWidget,
  useUpdateWidget,
  useDeleteWidget,
  useReorderWidgets,
  type DashboardWidget,
  type WidgetType,
  type CompletionRateData,
  type OverdueCountData,
  type MemberWorkloadData,
} from '@/api/dashboard'

const WIDGET_LABELS: Record<WidgetType, string> = {
  completion_rate: 'Completion Rate',
  overdue_count: 'Overdue Tasks',
  member_workload: 'Member Workload',
}

const WIDGET_DESCRIPTIONS: Record<WidgetType, string> = {
  completion_rate: 'Percentage of tasks marked as done',
  overdue_count: 'Tasks past their due date',
  member_workload: 'Open task count per team member',
}

export default function DashboardPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const currentUserId = useAuthStore((s) => s.user?.id)
  const [editMode, setEditMode] = useState(false)
  const [addOpen, setAddOpen] = useState(false)

  const { data: members = [] } = useWorkspaceMembers(workspaceId)
  const memberMap = Object.fromEntries(members.map((m) => [m.user_id, m]))
  const myRole = currentUserId ? memberMap[currentUserId]?.role : undefined
  const isAdmin = myRole === 'owner' || myRole === 'admin'

  const { data: widgets = [], isLoading } = useDashboardWidgets(workspaceId)
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['projects', workspaceId],
    queryFn: () => projectsApi.list(workspaceId!),
    enabled: !!workspaceId,
  })

  const reorder = useReorderWidgets(workspaceId!)

  const sensors = useSensors(useSensor(PointerSensor))

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = widgets.findIndex((w) => w.id === active.id)
    const newIndex = widgets.findIndex((w) => w.id === over.id)
    const reordered = arrayMove(widgets, oldIndex, newIndex)
    reorder.mutate(reordered.map((w) => w.id))
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <WorkspaceHeader workspaceId={workspaceId!} />

      <main className="max-w-5xl mx-auto py-8 sm:py-10 px-4 sm:px-6">
        {/* Page header */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Dashboard</h1>
            <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
              {isAdmin ? 'Workspace health at a glance. Edit to configure widgets.' : 'Workspace health at a glance.'}
            </p>
          </div>
          {isAdmin && (
            <div className="flex items-center gap-2 shrink-0">
              {editMode && (
                <button
                  onClick={() => setAddOpen(true)}
                  className="flex items-center gap-1.5 bg-violet-600 text-white text-sm px-3 py-2 rounded-lg hover:bg-violet-700 transition-colors font-medium"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  Add widget
                </button>
              )}
              <button
                onClick={() => { setEditMode((v) => !v); setAddOpen(false) }}
                className={`flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg font-medium transition-colors border ${
                  editMode
                    ? 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                {editMode ? 'Done' : 'Edit'}
              </button>
            </div>
          )}
        </div>

        {/* Add widget panel */}
        {addOpen && (
          <AddWidgetPanel
            workspaceId={workspaceId!}
            onClose={() => setAddOpen(false)}
            existingTypes={widgets.map((w) => w.widget_type)}
          />
        )}

        {/* Widget grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl h-44 animate-pulse ${i === 3 ? 'md:col-span-2' : ''}`}
              />
            ))}
          </div>
        ) : widgets.length === 0 ? (
          <div className="text-center py-20 bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
            <div className="w-12 h-12 bg-violet-50 dark:bg-violet-950 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-violet-400" aria-hidden="true">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
            </div>
            <p className="text-slate-700 dark:text-slate-300 font-medium mb-1">No widgets yet</p>
            <p className="text-slate-400 dark:text-slate-500 text-sm mb-5">
              {isAdmin ? 'Click Edit → Add widget to get started.' : 'An admin needs to configure dashboard widgets.'}
            </p>
            {isAdmin && (
              <button
                onClick={() => { setEditMode(true); setAddOpen(true) }}
                className="bg-violet-600 text-white text-sm px-5 py-2 rounded-lg hover:bg-violet-700 transition-colors font-medium"
              >
                Add widget
              </button>
            )}
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={widgets.map((w) => w.id)} strategy={verticalListSortingStrategy}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {widgets.map((widget) => (
                  <SortableWidget
                    key={widget.id}
                    widget={widget}
                    workspaceId={workspaceId!}
                    projects={projects}
                    editMode={editMode}
                    isAdmin={isAdmin}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </main>
    </div>
  )
}

// --- Sortable wrapper ---

function SortableWidget({
  widget,
  workspaceId,
  projects,
  editMode,
  isAdmin,
}: {
  widget: DashboardWidget
  workspaceId: string
  projects: Project[]
  editMode: boolean
  isAdmin: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: widget.id,
    disabled: !editMode,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const isWorkload = widget.widget_type === 'member_workload'

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={isWorkload ? 'md:col-span-2' : ''}
    >
      <WidgetCard
        widget={widget}
        workspaceId={workspaceId}
        projects={projects}
        editMode={editMode}
        isAdmin={isAdmin}
        dragHandleProps={editMode ? { ...attributes, ...listeners } : undefined}
      />
    </div>
  )
}

// --- Widget card shell ---

function WidgetCard({
  widget,
  workspaceId,
  projects,
  editMode,
  isAdmin,
  dragHandleProps,
}: {
  widget: DashboardWidget
  workspaceId: string
  projects: Project[]
  editMode: boolean
  isAdmin: boolean
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>
}) {
  const deleteWidget = useDeleteWidget(workspaceId)
  const updateWidget = useUpdateWidget(workspaceId)

  function handleProjectChange(projectId: string) {
    updateWidget.mutate({
      widgetId: widget.id,
      data: { config: { project_id: projectId || null } },
    })
  }

  function toggleVisibility() {
    updateWidget.mutate({
      widgetId: widget.id,
      data: { visible_to_members: !widget.visible_to_members },
    })
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm p-5 flex flex-col gap-4 relative">
      {/* Card header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {editMode && (
            <div
              {...dragHandleProps}
              className="shrink-0 text-slate-300 dark:text-slate-600 hover:text-slate-400 cursor-grab active:cursor-grabbing"
              aria-label="Drag to reorder"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <circle cx="9" cy="6" r="1" fill="currentColor" stroke="none" />
                <circle cx="15" cy="6" r="1" fill="currentColor" stroke="none" />
                <circle cx="9" cy="12" r="1" fill="currentColor" stroke="none" />
                <circle cx="15" cy="12" r="1" fill="currentColor" stroke="none" />
                <circle cx="9" cy="18" r="1" fill="currentColor" stroke="none" />
                <circle cx="15" cy="18" r="1" fill="currentColor" stroke="none" />
              </svg>
            </div>
          )}
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">
            {WIDGET_LABELS[widget.widget_type]}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Project filter */}
          <select
            value={widget.config.project_id ?? ''}
            onChange={(e) => handleProjectChange(e.target.value)}
            className="text-xs border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-violet-500"
          >
            <option value="">All projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          {/* Edit mode controls */}
          {editMode && isAdmin && (
            <>
              <button
                onClick={toggleVisibility}
                title={widget.visible_to_members ? 'Hide from members' : 'Show to members'}
                aria-label={widget.visible_to_members ? 'Hide from members' : 'Show to members'}
                className={`p-1.5 rounded-md transition-colors ${
                  widget.visible_to_members
                    ? 'text-violet-600 bg-violet-50 dark:bg-violet-950'
                    : 'text-slate-300 dark:text-slate-600 hover:text-slate-500'
                }`}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  {widget.visible_to_members ? (
                    <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>
                  ) : (
                    <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></>
                  )}
                </svg>
              </button>
              <button
                onClick={() => deleteWidget.mutate(widget.id)}
                aria-label="Remove widget"
                className="p-1.5 rounded-md text-slate-300 dark:text-slate-600 hover:text-red-500 transition-colors"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  <path d="M10 11v6M14 11v6" />
                  <path d="M9 6V4h6v2" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Widget body */}
      {widget.widget_type === 'completion_rate' && (
        <CompletionRateBody workspaceId={workspaceId} widgetId={widget.id} />
      )}
      {widget.widget_type === 'overdue_count' && (
        <OverdueCountBody workspaceId={workspaceId} widgetId={widget.id} />
      )}
      {widget.widget_type === 'member_workload' && (
        <MemberWorkloadBody workspaceId={workspaceId} widgetId={widget.id} />
      )}

      {/* Members-only badge when visible */}
      {!editMode && !widget.visible_to_members && isAdmin && (
        <div className="absolute bottom-3 right-4 text-[10px] text-slate-300 dark:text-slate-600 font-medium">Admin only</div>
      )}
    </div>
  )
}

// --- Widget bodies ---

function CompletionRateBody({ workspaceId, widgetId }: { workspaceId: string; widgetId: string }) {
  const { data, isLoading } = useWidgetData(workspaceId, widgetId)
  const d = data as CompletionRateData | undefined

  if (isLoading) return <WidgetSkeleton />

  const rate = d?.rate ?? 0
  const done = d?.done ?? 0
  const total = d?.total ?? 0

  // SVG donut
  const r = 36
  const circ = 2 * Math.PI * r
  const offset = circ - (rate / 100) * circ

  return (
    <div className="flex items-center gap-6">
      <div className="relative shrink-0">
        <svg width="96" height="96" viewBox="0 0 96 96" aria-label={`${rate}% complete`}>
          <circle cx="48" cy="48" r={r} fill="none" stroke="currentColor" strokeWidth="8" className="text-slate-100 dark:text-slate-800" />
          <circle
            cx="48"
            cy="48"
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="text-violet-500 transition-all duration-700"
            transform="rotate(-90 48 48)"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xl font-bold text-slate-900 dark:text-slate-100">{rate}%</span>
        </div>
      </div>
      <div className="space-y-1.5">
        <div>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{done}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500">tasks completed</p>
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500">{total} total tasks</p>
      </div>
    </div>
  )
}

function OverdueCountBody({ workspaceId, widgetId }: { workspaceId: string; widgetId: string }) {
  const { data, isLoading } = useWidgetData(workspaceId, widgetId)
  const d = data as OverdueCountData | undefined

  if (isLoading) return <WidgetSkeleton />

  const count = d?.count ?? 0
  const hasOverdue = count > 0

  return (
    <div className="flex items-center gap-4">
      <div className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 ${hasOverdue ? 'bg-red-50 dark:bg-red-950' : 'bg-slate-100 dark:bg-slate-800'}`}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={hasOverdue ? 'text-red-400' : 'text-slate-300'} aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <div>
        <p className={`text-3xl font-bold ${hasOverdue ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-slate-100'}`}>{count}</p>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
          {count === 1 ? 'task overdue' : 'tasks overdue'}
        </p>
      </div>
    </div>
  )
}

function MemberWorkloadBody({ workspaceId, widgetId }: { workspaceId: string; widgetId: string }) {
  const { data, isLoading } = useWidgetData(workspaceId, widgetId)
  const d = data as MemberWorkloadData | undefined
  const members = d?.members ?? []

  if (isLoading) return <WidgetSkeleton rows={4} />

  if (members.length === 0) {
    return <p className="text-sm text-slate-400 dark:text-slate-500 py-2">No members yet.</p>
  }

  const maxCount = Math.max(...members.map((m) => m.open_task_count), 1)

  return (
    <div className="space-y-3">
      {members.map((m) => {
        const pct = Math.round((m.open_task_count / maxCount) * 100)
        return (
          <div key={m.user_id} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-700 dark:text-slate-300 truncate max-w-[60%]">{m.display_name}</span>
              <span className="text-slate-400 dark:text-slate-500 tabular-nums">{m.open_task_count} open</span>
            </div>
            <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-1.5 rounded-full bg-violet-400 transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function WidgetSkeleton({ rows = 1 }: { rows?: number }) {
  if (rows === 1) {
    return (
      <div className="flex items-center gap-4">
        <div className="w-20 h-20 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse shrink-0" />
        <div className="space-y-2 flex-1">
          <div className="h-7 w-24 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
          <div className="h-3 w-32 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
        </div>
      </div>
    )
  }
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="space-y-1.5">
          <div className="h-3 w-32 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
          <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full animate-pulse" />
        </div>
      ))}
    </div>
  )
}

// --- Add widget panel ---

const ALL_WIDGET_TYPES: WidgetType[] = ['completion_rate', 'overdue_count', 'member_workload']

function AddWidgetPanel({
  workspaceId,
  onClose,
  existingTypes,
}: {
  workspaceId: string
  onClose: () => void
  existingTypes: WidgetType[]
}) {
  const createWidget = useCreateWidget(workspaceId)

  function add(type: WidgetType) {
    createWidget.mutate(
      { widget_type: type, visible_to_members: false },
      { onSuccess: onClose },
    )
  }

  return (
    <div className="mb-6 bg-white dark:bg-slate-900 border border-violet-200 dark:border-violet-800 rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Add a widget</p>
        <button
          onClick={onClose}
          aria-label="Close"
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {ALL_WIDGET_TYPES.map((type) => {
          const alreadyAdded = existingTypes.includes(type)
          return (
            <button
              key={type}
              disabled={alreadyAdded || createWidget.isPending}
              onClick={() => add(type)}
              className={`text-left p-4 rounded-xl border transition-all ${
                alreadyAdded
                  ? 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 opacity-50 cursor-not-allowed'
                  : 'border-slate-200 dark:border-slate-700 hover:border-violet-300 dark:hover:border-violet-700 hover:shadow-sm cursor-pointer'
              }`}
            >
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-0.5">{WIDGET_LABELS[type]}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">{WIDGET_DESCRIPTIONS[type]}</p>
              {alreadyAdded && (
                <p className="text-[11px] text-violet-500 mt-1.5 font-medium">Already added</p>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
