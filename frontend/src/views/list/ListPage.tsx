import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listsApi } from '@/api/lists'
import { tasksApi, type Task, type Priority } from '@/api/tasks'
import { useWorkspaceMembers, type Member } from '@/api/workspaces'
import { useListSocket } from '@/hooks/useTaskSocket'
import { useFieldDefinitions } from '@/api/customFields'
import HeaderActions from '@/components/HeaderActions'

const PRIORITY_DOT_COLORS: Record<Priority, string> = {
  none: '#cbd5e1',
  low: '#38bdf8',
  medium: '#fbbf24',
  high: '#f97316',
  urgent: '#ef4444',
}

const PRIORITIES: Priority[] = ['none', 'low', 'medium', 'high', 'urgent']

export default function ListPage() {
  const { projectId, listId } = useParams<{ projectId: string; listId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()

  useListSocket(listId)

  const { data: list } = useQuery({
    queryKey: ['list', listId],
    queryFn: () => listsApi.get(listId!),
  })

  const [newTitle, setNewTitle] = useState('')
  const [creating, setCreating] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState<Priority | ''>('')
  const [cfFilters, setCfFilters] = useState<Record<string, string>>({})

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks', listId, statusFilter, priorityFilter, cfFilters],
    queryFn: () => tasksApi.list(listId!, {
      status_id: statusFilter || undefined,
      priority: (priorityFilter as Priority) || undefined,
      cf: cfFilters,
    }),
  })

  const createTask = useMutation({
    mutationFn: (title: string) => tasksApi.create(listId!, { title }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks', listId] })
      setCreating(false)
      setNewTitle('')
    },
  })

  const deleteTask = useMutation({
    mutationFn: tasksApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks', listId] }),
  })

  const { data: fieldDefs = [] } = useFieldDefinitions(listId)
  const workspaceId = tasks[0]?.workspace_id
  const { data: members = [] } = useWorkspaceMembers(workspaceId)
  const memberMap = Object.fromEntries(members.map((m) => [m.user_id, m]))

  const statusMap = Object.fromEntries((list?.statuses ?? []).map((s) => [s.id, s]))

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 h-14 flex items-center gap-3">
        <Link to="/" className="text-slate-400 hover:text-slate-600 text-sm transition-colors">Home</Link>
        <span className="text-slate-300">/</span>
        <span className="text-sm font-medium text-slate-800">{list?.name}</span>
        <div className="ml-auto flex items-center gap-3">
          <Link
            to={`/projects/${projectId}/lists/${listId}/settings`}
            className="text-slate-400 hover:text-slate-600 text-xs transition-colors"
          >
            ⚙ Settings
          </Link>
          <div className="flex rounded-lg border border-slate-200 overflow-hidden">
            <span className="bg-violet-600 text-white px-3 py-1.5 text-xs font-medium">
              List
            </span>
            <Link
              to={`/projects/${projectId}/lists/${listId}/board`}
              className="bg-white text-slate-500 px-3 py-1.5 text-xs font-medium hover:bg-slate-50 transition-colors"
            >
              Board
            </Link>
          </div>
          <HeaderActions />
        </div>
      </header>

      <main className="max-w-5xl mx-auto py-8 px-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-slate-900">{list?.name}</h2>
          <button
            onClick={() => setCreating(true)}
            className="bg-violet-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-violet-700 transition-colors font-medium"
          >
            + New task
          </button>
        </div>

        <div className="mb-5 flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-400 font-medium shrink-0">Filter</span>
          <div className="w-px h-4 bg-slate-200 shrink-0" />

          {/* Status */}
          <FilterSelect
            value={statusFilter}
            onChange={setStatusFilter}
            label="Status"
            active={!!statusFilter}
            activeLabel={(list?.statuses ?? []).find((s) => s.id === statusFilter)?.name}
          >
            <option value="">All statuses</option>
            {(list?.statuses ?? []).map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </FilterSelect>

          {/* Priority */}
          <FilterSelect
            value={priorityFilter}
            onChange={(v) => setPriorityFilter(v as Priority | '')}
            label="Priority"
            active={!!priorityFilter}
            activeLabel={priorityFilter || undefined}
          >
            <option value="">All priorities</option>
            {PRIORITIES.filter((p) => p !== 'none').map((p) => (
              <option key={p} value={p} className="capitalize">{p}</option>
            ))}
          </FilterSelect>

          {/* Custom fields */}
          {fieldDefs.map((field) => {
            const val = cfFilters[field.id] ?? ''
            const set = (v: string) => setCfFilters((prev) => {
              const next = { ...prev }
              if (v) next[field.id] = v; else delete next[field.id]
              return next
            })
            if (field.field_type === 'dropdown' || field.field_type === 'checkbox') {
              return (
                <FilterSelect
                  key={field.id}
                  value={val}
                  onChange={set}
                  label={field.name}
                  active={!!val}
                  activeLabel={val === 'true' ? 'Yes' : val === 'false' ? 'No' : val}
                >
                  <option value="">All</option>
                  {field.field_type === 'checkbox' ? (
                    <>
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </>
                  ) : (
                    (field.options_json ?? []).map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))
                  )}
                </FilterSelect>
              )
            }
            return (
              <input
                key={field.id}
                type={field.field_type === 'number' ? 'number' : field.field_type === 'date' ? 'date' : 'text'}
                value={val}
                onChange={(e) => set(e.target.value)}
                placeholder={field.name}
                className={`h-8 border rounded-full px-3 text-xs focus:outline-none focus:ring-2 focus:ring-violet-500 w-32 transition-colors ${
                  val ? 'border-violet-400 bg-violet-50 text-violet-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              />
            )
          })}

          {(statusFilter || priorityFilter || Object.keys(cfFilters).length > 0) && (
            <button
              onClick={() => { setStatusFilter(''); setPriorityFilter(''); setCfFilters({}) }}
              className="h-8 flex items-center gap-1 text-xs text-slate-400 hover:text-red-500 transition-colors px-2 rounded-full hover:bg-red-50"
            >
              <span>✕</span> Clear
            </button>
          )}
        </div>

        {creating && (
          <form
            className="mb-4 flex gap-2"
            onSubmit={(e) => { e.preventDefault(); createTask.mutate(newTitle) }}
          >
            <input
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Task title"
              className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
            <button type="submit" className="bg-violet-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-violet-700 transition-colors">Create</button>
            <button type="button" onClick={() => setCreating(false)} className="text-sm px-3 py-2 text-slate-500 hover:text-slate-700 transition-colors">Cancel</button>
          </form>
        )}

        {isLoading ? (
          <p className="text-slate-400 text-sm">Loading...</p>
        ) : tasks.length === 0 ? (
          <p className="text-slate-400 text-sm">No tasks yet.</p>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Title</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Priority</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Assignees</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Reviewer</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tasks.map((task: Task) => (
                  <tr key={task.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <button
                        onClick={() => navigate(`/tasks/${task.id}`)}
                        className="text-left font-medium text-slate-800 hover:text-violet-600 transition-colors"
                      >
                        {task.title}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      {task.status_id && statusMap[task.status_id] ? (
                        <span
                          className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full"
                          style={{ backgroundColor: statusMap[task.status_id].color + '20', color: statusMap[task.status_id].color }}
                        >
                          {statusMap[task.status_id].name}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5 text-xs font-medium capitalize text-slate-600">
                        <span
                          className="w-2 h-2 rounded-full inline-block shrink-0"
                          style={{ backgroundColor: PRIORITY_DOT_COLORS[task.priority] }}
                        />
                        {task.priority === 'none' ? '—' : task.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <AvatarStack ids={task.assignee_ids} memberMap={memberMap} />
                    </td>
                    <td className="px-4 py-3">
                      {task.reviewer_id && memberMap[task.reviewer_id] ? (
                        <Avatar member={memberMap[task.reviewer_id]} title="Reviewer" />
                      ) : (
                        <span className="text-slate-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => deleteTask.mutate(task.id)}
                        className="text-slate-300 hover:text-red-400 text-xs transition-colors"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}

function Avatar({ member, title }: { member: Member; title?: string }) {
  return (
    <span
      title={`${title ? title + ': ' : ''}${member.display_name}`}
      className="inline-flex w-7 h-7 rounded-full bg-violet-100 text-violet-700 text-xs font-semibold items-center justify-center border-2 border-white shadow-sm select-none"
    >
      {member.display_name[0].toUpperCase()}
    </span>
  )
}

function FilterSelect({
  value, onChange, label, active, activeLabel, children,
}: {
  value: string
  onChange: (v: string) => void
  label: string
  active: boolean
  activeLabel?: string
  children: React.ReactNode
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`h-8 appearance-none pl-3 pr-7 rounded-full text-xs font-medium border cursor-pointer focus:outline-none focus:ring-2 focus:ring-violet-500 transition-colors ${
          active
            ? 'border-violet-400 bg-violet-50 text-violet-700'
            : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700'
        }`}
      >
        {children}
      </select>
      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-current opacity-60">▾</span>
    </div>
  )
}

function AvatarStack({ ids, memberMap }: { ids: string[]; memberMap: Record<string, Member> }) {
  if (ids.length === 0) return <span className="text-slate-300 text-xs">—</span>
  return (
    <div className="flex -space-x-1.5">
      {ids.slice(0, 4).map((id) =>
        memberMap[id] ? (
          <Avatar key={id} member={memberMap[id]} />
        ) : null
      )}
      {ids.length > 4 && (
        <span className="inline-flex w-7 h-7 rounded-full bg-slate-100 text-slate-500 text-xs font-semibold items-center justify-center border-2 border-white shadow-sm">
          +{ids.length - 4}
        </span>
      )}
    </div>
  )
}
