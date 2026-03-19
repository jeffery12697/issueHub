import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { listsApi, type ListStatus } from '@/api/lists'
import { useFieldDefinitions, useCreateField, useDeleteField, useUpdateField, type FieldType, type FieldDefinition } from '@/api/customFields'
import { useTeams } from '@/api/teams'
import { useWorkspaceMembers } from '@/api/workspaces'
import { automationsApi, type Automation, type TriggerType, type ActionType, type CreateAutomationBody } from '@/api/automations'
import HeaderActions from '@/components/HeaderActions'
import DeleteButton from '@/components/DeleteButton'

export default function ListSettingsPage() {
  const { projectId, listId } = useParams<{ projectId: string; listId: string }>()
  const [activeTab, setActiveTab] = useState<'statuses' | 'custom-fields' | 'visibility' | 'reviewers' | 'automations'>('statuses')

  const { data: list } = useQuery({
    queryKey: ['list', listId],
    queryFn: () => listsApi.get(listId!),
    enabled: !!listId,
  })

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-4 sm:px-6 h-14 flex items-center gap-3">
        <Link
          to={`/projects/${projectId}/lists/${listId}`}
          className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 text-sm transition-colors"
        >
          ← Back to list
        </Link>
        <span className="text-slate-300 dark:text-slate-600">/</span>
        <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{list?.name}</span>
        <span className="text-slate-300 dark:text-slate-600">/</span>
        <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Settings</span>
        <div className="ml-auto"><HeaderActions /></div>
      </header>

      <main className="max-w-3xl mx-auto py-8 sm:py-10 px-4 sm:px-6">
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <button
            onClick={() => setActiveTab('statuses')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              activeTab === 'statuses'
                ? 'bg-violet-600 text-white'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            Statuses
          </button>
          <button
            onClick={() => setActiveTab('custom-fields')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              activeTab === 'custom-fields'
                ? 'bg-violet-600 text-white'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            Custom Fields
          </button>
          <button
            onClick={() => setActiveTab('visibility')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              activeTab === 'visibility'
                ? 'bg-violet-600 text-white'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            Visibility
          </button>
          <button
            onClick={() => setActiveTab('reviewers')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              activeTab === 'reviewers'
                ? 'bg-violet-600 text-white'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            Reviewers
          </button>
          <button
            onClick={() => setActiveTab('automations')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              activeTab === 'automations'
                ? 'bg-violet-600 text-white'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            Automations
          </button>
        </div>

        {activeTab === 'statuses' && listId && (
          <StatusesTab listId={listId} statuses={list?.statuses ?? []} />
        )}
        {activeTab === 'custom-fields' && listId && (
          <CustomFieldsTab listId={listId} />
        )}
        {activeTab === 'visibility' && listId && list && (
          <VisibilityTab listId={listId} currentTeamIds={list.team_ids ?? []} />
        )}
        {activeTab === 'reviewers' && listId && list && (
          <ReviewersTab listId={listId} currentReviewerIds={list.reviewer_ids ?? []} />
        )}
        {activeTab === 'automations' && listId && (
          <AutomationsTab listId={listId} statuses={list?.statuses ?? []} />
        )}
      </main>
    </div>
  )
}

function StatusesTab({ listId, statuses }: { listId: string; statuses: ListStatus[] }) {
  const qc = useQueryClient()
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('#94a3b8')

  const invalidate = () => qc.invalidateQueries({ queryKey: ['list', listId] })

  const createStatus = useMutation({
    mutationFn: (data: { name: string; color: string }) =>
      listsApi.createStatus(listId, data),
    onSuccess: invalidate,
  })

  const updateStatus = useMutation({
    mutationFn: ({ statusId, data }: { statusId: string; data: Partial<ListStatus> }) =>
      listsApi.updateStatus(listId, statusId, data),
    onSuccess: invalidate,
  })

  const deleteStatus = useMutation({
    mutationFn: (statusId: string) => listsApi.deleteStatus(listId, statusId),
    onSuccess: invalidate,
  })

  const reorderStatus = useMutation({
    mutationFn: ({ statusId, beforeId, afterId }: { statusId: string; beforeId?: string; afterId?: string }) =>
      listsApi.reorderStatus(listId, statusId, { before_id: beforeId, after_id: afterId }),
    onSuccess: invalidate,
  })

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const ids = statuses.map((s) => s.id)
    const oldIdx = ids.indexOf(active.id as string)
    const newIdx = ids.indexOf(over.id as string)
    if (oldIdx === -1 || newIdx === -1) return

    // Determine before_id / after_id relative to the drop position
    const reordered = [...ids]
    reordered.splice(oldIdx, 1)
    reordered.splice(newIdx, 0, active.id as string)

    const pos = reordered.indexOf(active.id as string)
    const beforeId = pos > 0 ? reordered[pos - 1] : undefined
    const afterId = pos < reordered.length - 1 ? reordered[pos + 1] : undefined

    reorderStatus.mutate({ statusId: active.id as string, beforeId, afterId })
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm p-5">
      <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4 block">
        Statuses
      </label>

      {statuses.length === 0 ? (
        <p className="text-sm text-slate-400 dark:text-slate-500 mb-4">No statuses yet.</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={statuses.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2 mb-6">
              {statuses.map((status) => (
                <StatusRow
                  key={status.id}
                  status={status}
                  onUpdate={(data) => updateStatus.mutate({ statusId: status.id, data })}
                  onDelete={() => deleteStatus.mutate(status.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
        <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">Add Status</p>
        <form
          className="flex gap-2 items-center"
          onSubmit={(e) => {
            e.preventDefault()
            if (!newName.trim()) return
            createStatus.mutate({ name: newName.trim(), color: newColor })
            setNewName('')
            setNewColor('#94a3b8')
          }}
        >
          <input
            type="color"
            value={newColor}
            onChange={(e) => setNewColor(e.target.value)}
            className="w-9 h-9 rounded-lg border border-slate-300 dark:border-slate-600 cursor-pointer p-0.5"
          />
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Status name"
            className="flex-1 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 dark:placeholder-slate-500"
          />
          <button
            type="submit"
            className="bg-violet-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-violet-700 transition-colors font-medium"
          >
            Create
          </button>
        </form>
      </div>
    </div>
  )
}

function StatusRow({
  status,
  onUpdate,
  onDelete,
}: {
  status: ListStatus
  onUpdate: (data: Partial<ListStatus>) => void
  onDelete: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(status.name)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: status.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 py-2 px-3 rounded-lg border border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 transition-colors bg-white dark:bg-slate-900"
    >
      {/* drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="text-slate-300 dark:text-slate-600 hover:text-slate-500 dark:hover:text-slate-400 cursor-grab active:cursor-grabbing touch-none"
        tabIndex={-1}
        aria-label="Drag to reorder"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="5" cy="4" r="1.5"/><circle cx="11" cy="4" r="1.5"/>
          <circle cx="5" cy="8" r="1.5"/><circle cx="11" cy="8" r="1.5"/>
          <circle cx="5" cy="12" r="1.5"/><circle cx="11" cy="12" r="1.5"/>
        </svg>
      </button>

      <input
        type="color"
        value={status.color}
        onChange={(e) => onUpdate({ color: e.target.value })}
        className="w-6 h-6 rounded-full border-0 cursor-pointer p-0"
        title="Pick color"
      />

      {editing ? (
        <form
          className="flex-1 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (!name.trim()) { setName(status.name); setEditing(false); return }
            onUpdate({ name: name.trim() })
            setEditing(false)
          }}
        >
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => {
              if (!name.trim()) { setName(status.name); setEditing(false); return }
              onUpdate({ name: name.trim() })
              setEditing(false)
            }}
            className="flex-1 border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
          />
        </form>
      ) : (
        <span
          className="flex-1 text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
          onClick={() => setEditing(true)}
        >
          {status.name}
        </span>
      )}

      <label className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={status.is_complete}
          onChange={(e) => onUpdate({ is_complete: e.target.checked })}
          className="w-3.5 h-3.5 rounded border-slate-300 text-violet-600"
        />
        Done
      </label>

      <DeleteButton
        variant="text"
        message={`Delete status "${status.name}"? Tasks using it will lose their status.`}
        onConfirm={onDelete}
      />
    </div>
  )
}

function VisibilityTab({ listId, currentTeamIds }: { listId: string; currentTeamIds: string[] }) {
  const { projectId } = useParams<{ projectId: string }>()
  const qc = useQueryClient()

  // Get workspace_id from project
  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => import('@/api/projects').then((m) => m.projectsApi.get(projectId!)),
    enabled: !!projectId,
  })

  const { data: teams = [] } = useTeams(project?.workspace_id)

  const [selectedIds, setSelectedIds] = useState<string[]>(currentTeamIds)

  // Keep local state in sync with prop changes
  const toggleTeam = (teamId: string) =>
    setSelectedIds((prev) =>
      prev.includes(teamId) ? prev.filter((id) => id !== teamId) : [...prev, teamId]
    )

  const saveMutation = useMutation({
    mutationFn: () => listsApi.setVisibility(listId, { team_ids: selectedIds }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['list', listId] })
      qc.invalidateQueries({ queryKey: ['lists'] })
    },
  })

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm p-5">
      <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4 block">
        Team Visibility
      </label>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
        Restrict this list to specific teams. Leave all unchecked to make it visible to all workspace members.
      </p>

      {teams.length === 0 ? (
        <p className="text-sm text-slate-400 dark:text-slate-500 mb-4">No teams in this workspace yet.</p>
      ) : (
        <div className="space-y-2 mb-6">
          {teams.map((team) => (
            <label
              key={team.id}
              className="flex items-center gap-3 py-2 px-3 rounded-lg border border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 cursor-pointer transition-colors"
            >
              <input
                type="checkbox"
                checked={selectedIds.includes(team.id)}
                onChange={() => toggleTeam(team.id)}
                className="w-4 h-4 rounded border-slate-300 text-violet-600"
              />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{team.name}</span>
            </label>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="bg-violet-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-violet-700 transition-colors font-medium disabled:opacity-60"
        >
          {saveMutation.isPending ? 'Saving…' : 'Save visibility'}
        </button>
        {saveMutation.isSuccess && (
          <span className="text-xs text-green-600 font-medium">Saved</span>
        )}
      </div>
    </div>
  )
}

function ReviewersTab({ listId, currentReviewerIds }: { listId: string; currentReviewerIds: string[] }) {
  const { projectId } = useParams<{ projectId: string }>()
  const qc = useQueryClient()

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => import('@/api/projects').then((m) => m.projectsApi.get(projectId!)),
    enabled: !!projectId,
  })

  const { data: members = [] } = useWorkspaceMembers(project?.workspace_id)

  const [selectedIds, setSelectedIds] = useState<string[]>(currentReviewerIds)

  const toggleMember = (userId: string) =>
    setSelectedIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    )

  const saveMutation = useMutation({
    mutationFn: () => listsApi.setReviewers(listId, { reviewer_ids: selectedIds }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['list', listId] })
    },
  })

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm p-5">
      <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4 block">
        Allowed Reviewers
      </label>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
        Restrict who can be assigned as a reviewer on tasks in this list. Leave all unchecked to allow any workspace member.
      </p>

      {members.length === 0 ? (
        <p className="text-sm text-slate-400 dark:text-slate-500 mb-4">No members in this workspace yet.</p>
      ) : (
        <div className="space-y-2 mb-6">
          {members.map((member) => (
            <label
              key={member.user_id}
              className="flex items-center gap-3 py-2 px-3 rounded-lg border border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 cursor-pointer transition-colors"
            >
              <input
                type="checkbox"
                checked={selectedIds.includes(member.user_id)}
                onChange={() => toggleMember(member.user_id)}
                className="w-4 h-4 rounded border-slate-300 text-violet-600"
              />
              <span className="w-6 h-6 rounded-full bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-300 flex items-center justify-center text-xs font-bold shrink-0">
                {member.display_name[0].toUpperCase()}
              </span>
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{member.display_name}</span>
              <span className="ml-auto text-xs text-slate-400 dark:text-slate-500 capitalize">{member.role}</span>
            </label>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="bg-violet-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-violet-700 transition-colors font-medium disabled:opacity-60"
        >
          {saveMutation.isPending ? 'Saving…' : 'Save reviewers'}
        </button>
        {saveMutation.isSuccess && (
          <span className="text-xs text-green-600 font-medium">Saved</span>
        )}
      </div>
    </div>
  )
}

function CustomFieldsTab({ listId }: { listId: string }) {
  const { data: fieldDefs = [] } = useFieldDefinitions(listId)
  const createField = useCreateField(listId)
  const deleteField = useDeleteField(listId)
  const updateField = useUpdateField(listId)

  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState<FieldType>('text')
  const [newRequired, setNewRequired] = useState(false)
  const [newOptions, setNewOptions] = useState('')
  const [newVisibility, setNewVisibility] = useState<string[]>([])
  const [newEditable, setNewEditable] = useState<string[]>([])

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm p-5">
      <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4 block">
        Custom Fields
      </label>

      {fieldDefs.length === 0 ? (
        <p className="text-sm text-slate-400 dark:text-slate-500 mb-4">No custom fields yet.</p>
      ) : (
        <div className="space-y-2 mb-6">
          {fieldDefs.map((field) => (
            <FieldRow
              key={field.id}
              field={field}
              onUpdate={(data) => updateField.mutate({ fieldId: field.id, data })}
              onDelete={() => deleteField.mutate(field.id)}
            />
          ))}
        </div>
      )}

      <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
        <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">Add Field</p>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (!newName.trim()) return
            const options =
              newType === 'dropdown'
                ? newOptions
                    .split('\n')
                    .map((o) => o.trim())
                    .filter(Boolean)
                : null
            createField.mutate({
              name: newName.trim(),
              field_type: newType,
              is_required: newRequired,
              options_json: options,
              visibility_roles: newVisibility,
              editable_roles: newEditable,
            })
            setNewName('')
            setNewType('text')
            setNewRequired(false)
            setNewOptions('')
            setNewVisibility([])
            setNewEditable([])
          }}
        >
          <div className="flex gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Field name"
              className="flex-1 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 dark:placeholder-slate-500"
            />
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value as FieldType)}
              className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            >
              <option value="text">text</option>
              <option value="number">number</option>
              <option value="date">date</option>
              <option value="dropdown">dropdown</option>
              <option value="checkbox">checkbox</option>
              <option value="url">url</option>
            </select>
          </div>

          {newType === 'dropdown' && (
            <textarea
              value={newOptions}
              onChange={(e) => setNewOptions(e.target.value)}
              placeholder="Options (one per line)"
              rows={3}
              className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 dark:placeholder-slate-500"
            />
          )}

          <div className="flex items-center gap-4 flex-wrap">
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={newRequired}
                onChange={(e) => setNewRequired(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-violet-600"
              />
              Required
            </label>
          </div>

          <RolePicker label="Visible to (empty = all)" value={newVisibility} onChange={setNewVisibility} />
          <RolePicker label="Editable by (empty = all)" value={newEditable} onChange={setNewEditable} />

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={createField.isPending}
              className="bg-violet-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-violet-700 transition-colors font-medium disabled:opacity-60"
            >
              {createField.isPending ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const ALL_ROLES = ['owner', 'admin', 'member']

function RolePicker({ label, value, onChange }: { label: string; value: string[]; onChange: (v: string[]) => void }) {
  const toggle = (role: string) =>
    onChange(value.includes(role) ? value.filter((r) => r !== role) : [...value, role])
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <span className="text-xs text-slate-500 dark:text-slate-400 w-40 shrink-0">{label}</span>
      <div className="flex gap-3">
        {ALL_ROLES.map((role) => (
          <label key={role} className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer select-none capitalize">
            <input
              type="checkbox"
              checked={value.includes(role)}
              onChange={() => toggle(role)}
              className="w-3.5 h-3.5 rounded border-slate-300 text-violet-600"
            />
            {role}
          </label>
        ))}
      </div>
    </div>
  )
}

// ── Automations ───────────────────────────────────────────────────────────────

const TRIGGER_LABELS: Record<TriggerType, string> = {
  status_changed: 'Status changes to',
  priority_changed: 'Priority changes to',
}

const ACTION_LABELS: Record<ActionType, string> = {
  set_status: 'Set status to',
  set_priority: 'Set priority to',
  assign_reviewer: 'Set reviewer to',
  clear_assignees: 'Clear all assignees',
}

const PRIORITIES = ['none', 'low', 'medium', 'high', 'urgent'] as const

function AutomationsTab({ listId, statuses }: { listId: string; statuses: ListStatus[] }) {
  const { projectId } = useParams<{ projectId: string }>()
  const qc = useQueryClient()
  const { data: automations = [] } = useQuery({
    queryKey: ['automations', listId],
    queryFn: () => automationsApi.list(listId),
  })

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => import('@/api/projects').then((m) => m.projectsApi.get(projectId!)),
    enabled: !!projectId,
  })
  const { data: members = [] } = useWorkspaceMembers(project?.workspace_id)

  const [triggerType, setTriggerType] = useState<TriggerType>('status_changed')
  const [triggerValue, setTriggerValue] = useState('')
  const [actionType, setActionType] = useState<ActionType>('set_priority')
  const [actionValue, setActionValue] = useState('')

  const invalidate = () => qc.invalidateQueries({ queryKey: ['automations', listId] })

  const createMutation = useMutation({
    mutationFn: (body: CreateAutomationBody) => automationsApi.create(listId, body),
    onSuccess: () => {
      invalidate()
      setTriggerValue('')
      setActionValue('')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => automationsApi.delete(id),
    onSuccess: invalidate,
  })

  const needsActionValue = actionType !== 'clear_assignees'

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!triggerValue.trim()) return
    if (needsActionValue && !actionValue.trim()) return
    createMutation.mutate({
      trigger_type: triggerType,
      trigger_value: triggerValue,
      action_type: actionType,
      action_value: needsActionValue ? actionValue : null,
    })
  }

  function describeAutomation(a: Automation): string {
    const triggerLabel = TRIGGER_LABELS[a.trigger_type]
    const actionLabel = ACTION_LABELS[a.action_type]
    const triggerDisplay =
      a.trigger_type === 'status_changed'
        ? (statuses.find((s) => s.id === a.trigger_value)?.name ?? a.trigger_value)
        : a.trigger_value
    const actionDisplay =
      a.action_type === 'set_status'
        ? (statuses.find((s) => s.id === a.action_value)?.name ?? a.action_value ?? '')
        : a.action_type === 'assign_reviewer'
          ? (members.find((m) => m.user_id === a.action_value)?.display_name ?? a.action_value ?? '')
          : a.action_value ?? ''
    return `When ${triggerLabel} "${triggerDisplay}" → ${actionLabel}${actionDisplay ? ` "${actionDisplay}"` : ''}`
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm p-5">
      <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4 block">
        Automation Rules
      </label>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
        Automatically apply actions when a task is updated. Rules run in order.
      </p>

      {automations.length === 0 ? (
        <p className="text-sm text-slate-400 dark:text-slate-500 mb-4">No automation rules yet.</p>
      ) : (
        <div className="space-y-2 mb-6">
          {automations.map((a) => (
            <div
              key={a.id}
              className="flex items-center gap-3 py-2 px-3 rounded-lg border border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 transition-colors"
            >
              <span className="flex-1 text-sm text-slate-700 dark:text-slate-300">{describeAutomation(a)}</span>
              <DeleteButton
                variant="text"
                message="Delete this automation rule?"
                onConfirm={() => deleteMutation.mutate(a.id)}
              />
            </div>
          ))}
        </div>
      )}

      <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
        <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">Add Rule</p>
        <form className="space-y-3" onSubmit={handleSubmit}>
          <div className="flex gap-2 items-center flex-wrap">
            <span className="text-sm text-slate-500 dark:text-slate-400 shrink-0">When</span>
            <select
              value={triggerType}
              onChange={(e) => { setTriggerType(e.target.value as TriggerType); setTriggerValue('') }}
              className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            >
              {(Object.entries(TRIGGER_LABELS) as [TriggerType, string][]).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            {triggerType === 'status_changed' ? (
              <select
                value={triggerValue}
                onChange={(e) => setTriggerValue(e.target.value)}
                className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                <option value="">— pick status —</option>
                {statuses.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            ) : (
              <select
                value={triggerValue}
                onChange={(e) => setTriggerValue(e.target.value)}
                className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                <option value="">— pick priority —</option>
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            )}
          </div>

          <div className="flex gap-2 items-center flex-wrap">
            <span className="text-sm text-slate-500 dark:text-slate-400 shrink-0">Then</span>
            <select
              value={actionType}
              onChange={(e) => { setActionType(e.target.value as ActionType); setActionValue('') }}
              className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            >
              {(Object.entries(ACTION_LABELS) as [ActionType, string][]).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            {actionType === 'set_status' && (
              <select
                value={actionValue}
                onChange={(e) => setActionValue(e.target.value)}
                className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                <option value="">— pick status —</option>
                {statuses.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            )}
            {actionType === 'set_priority' && (
              <select
                value={actionValue}
                onChange={(e) => setActionValue(e.target.value)}
                className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                <option value="">— pick priority —</option>
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            )}
            {actionType === 'assign_reviewer' && (
              <select
                value={actionValue}
                onChange={(e) => setActionValue(e.target.value)}
                className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                <option value="">— pick reviewer —</option>
                {members.map((m) => (
                  <option key={m.user_id} value={m.user_id}>{m.display_name}</option>
                ))}
              </select>
            )}
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="bg-violet-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-violet-700 transition-colors font-medium disabled:opacity-60"
            >
              {createMutation.isPending ? 'Adding…' : 'Add Rule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function FieldRow({
  field,
  onUpdate,
  onDelete,
}: {
  field: FieldDefinition
  onUpdate: (data: { is_required?: boolean; visibility_roles?: string[]; editable_roles?: string[] }) => void
  onDelete: () => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded-lg border border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 transition-colors">
      <div className="flex items-center gap-3 py-2 px-3">
        <span className="flex-1 text-sm font-bold text-slate-700 dark:text-slate-300">{field.name}</span>
        <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-full">{field.field_type}</span>
        {field.is_required && (
          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Required</span>
        )}
        <label className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={field.is_required}
            onChange={(e) => onUpdate({ is_required: e.target.checked })}
            className="w-3.5 h-3.5 rounded border-slate-300 text-violet-600"
          />
          Required
        </label>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-xs text-slate-400 dark:text-slate-500 hover:text-violet-600 transition-colors"
        >
          Roles {expanded ? '▲' : '▼'}
        </button>
        <DeleteButton
          variant="text"
          message={`Delete field "${field.name}"? All task values for this field will be lost.`}
          onConfirm={onDelete}
        />
      </div>
      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-slate-100 dark:border-slate-800 pt-2">
          <RolePicker
            label="Visible to (empty = all)"
            value={field.visibility_roles}
            onChange={(v) => onUpdate({ visibility_roles: v })}
          />
          <RolePicker
            label="Editable by (empty = all)"
            value={field.editable_roles}
            onChange={(v) => onUpdate({ editable_roles: v })}
          />
        </div>
      )}
    </div>
  )
}
