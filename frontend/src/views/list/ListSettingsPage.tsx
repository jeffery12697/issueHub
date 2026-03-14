import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listsApi, type ListStatus } from '@/api/lists'
import { useFieldDefinitions, useCreateField, useDeleteField, useUpdateField, type FieldType, type FieldDefinition } from '@/api/customFields'
import { useTeams } from '@/api/teams'
import { automationsApi, type Automation, type TriggerType, type ActionType, type CreateAutomationBody } from '@/api/automations'
import HeaderActions from '@/components/HeaderActions'
import DeleteButton from '@/components/DeleteButton'

export default function ListSettingsPage() {
  const { projectId, listId } = useParams<{ projectId: string; listId: string }>()
  const [activeTab, setActiveTab] = useState<'statuses' | 'custom-fields' | 'visibility' | 'automations'>('statuses')

  const { data: list } = useQuery({
    queryKey: ['list', listId],
    queryFn: () => listsApi.get(listId!),
    enabled: !!listId,
  })

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 h-14 flex items-center gap-3">
        <Link
          to={`/projects/${projectId}/lists/${listId}`}
          className="text-slate-400 hover:text-slate-600 text-sm transition-colors"
        >
          ← Back to list
        </Link>
        <span className="text-slate-300">/</span>
        <span className="text-sm font-medium text-slate-800">{list?.name}</span>
        <span className="text-slate-300">/</span>
        <span className="text-sm font-medium text-slate-500">Settings</span>
        <div className="ml-auto"><HeaderActions /></div>
      </header>

      <main className="max-w-3xl mx-auto py-8 px-6">
        <div className="flex items-center gap-2 mb-6">
          <button
            onClick={() => setActiveTab('statuses')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              activeTab === 'statuses'
                ? 'bg-violet-600 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            Statuses
          </button>
          <button
            onClick={() => setActiveTab('custom-fields')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              activeTab === 'custom-fields'
                ? 'bg-violet-600 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            Custom Fields
          </button>
          <button
            onClick={() => setActiveTab('visibility')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              activeTab === 'visibility'
                ? 'bg-violet-600 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            Visibility
          </button>
          <button
            onClick={() => setActiveTab('automations')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              activeTab === 'automations'
                ? 'bg-violet-600 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
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

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 block">
        Statuses
      </label>

      {statuses.length === 0 ? (
        <p className="text-sm text-slate-400 mb-4">No statuses yet.</p>
      ) : (
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
      )}

      <div className="border-t border-slate-100 pt-4">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Add Status</p>
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
            className="w-9 h-9 rounded-lg border border-slate-300 cursor-pointer p-0.5"
          />
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Status name"
            className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
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

  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded-lg border border-slate-100 hover:border-slate-200 transition-colors">
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
            onUpdate({ name })
            setEditing(false)
          }}
        >
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => {
              onUpdate({ name })
              setEditing(false)
            }}
            className="flex-1 border border-slate-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </form>
      ) : (
        <span
          className="flex-1 text-sm font-medium text-slate-700 cursor-pointer hover:text-violet-600 transition-colors"
          onClick={() => setEditing(true)}
        >
          {status.name}
        </span>
      )}

      <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer select-none">
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
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 block">
        Team Visibility
      </label>
      <p className="text-sm text-slate-500 mb-4">
        Restrict this list to specific teams. Leave all unchecked to make it visible to all workspace members.
      </p>

      {teams.length === 0 ? (
        <p className="text-sm text-slate-400 mb-4">No teams in this workspace yet.</p>
      ) : (
        <div className="space-y-2 mb-6">
          {teams.map((team) => (
            <label
              key={team.id}
              className="flex items-center gap-3 py-2 px-3 rounded-lg border border-slate-100 hover:border-slate-200 cursor-pointer transition-colors"
            >
              <input
                type="checkbox"
                checked={selectedIds.includes(team.id)}
                onChange={() => toggleTeam(team.id)}
                className="w-4 h-4 rounded border-slate-300 text-violet-600"
              />
              <span className="text-sm font-medium text-slate-700">{team.name}</span>
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
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 block">
        Custom Fields
      </label>

      {fieldDefs.length === 0 ? (
        <p className="text-sm text-slate-400 mb-4">No custom fields yet.</p>
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

      <div className="border-t border-slate-100 pt-4">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Add Field</p>
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
              className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value as FieldType)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
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
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
            />
          )}

          <div className="flex items-center gap-4 flex-wrap">
            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
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
              className="bg-violet-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-violet-700 transition-colors font-medium"
            >
              Create
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
      <span className="text-xs text-slate-500 w-40 shrink-0">{label}</span>
      <div className="flex gap-3">
        {ALL_ROLES.map((role) => (
          <label key={role} className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none capitalize">
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
  const qc = useQueryClient()
  const { data: automations = [] } = useQuery({
    queryKey: ['automations', listId],
    queryFn: () => automationsApi.list(listId),
  })

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
        : a.action_value ?? ''
    return `When ${triggerLabel} "${triggerDisplay}" → ${actionLabel}${actionDisplay ? ` "${actionDisplay}"` : ''}`
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 block">
        Automation Rules
      </label>
      <p className="text-sm text-slate-500 mb-4">
        Automatically apply actions when a task is updated. Rules run in order.
      </p>

      {automations.length === 0 ? (
        <p className="text-sm text-slate-400 mb-4">No automation rules yet.</p>
      ) : (
        <div className="space-y-2 mb-6">
          {automations.map((a) => (
            <div
              key={a.id}
              className="flex items-center gap-3 py-2 px-3 rounded-lg border border-slate-100 hover:border-slate-200 transition-colors"
            >
              <span className="flex-1 text-sm text-slate-700">{describeAutomation(a)}</span>
              <DeleteButton
                variant="text"
                message="Delete this automation rule?"
                onConfirm={() => deleteMutation.mutate(a.id)}
              />
            </div>
          ))}
        </div>
      )}

      <div className="border-t border-slate-100 pt-4">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Add Rule</p>
        <form className="space-y-3" onSubmit={handleSubmit}>
          <div className="flex gap-2 items-center flex-wrap">
            <span className="text-sm text-slate-500 shrink-0">When</span>
            <select
              value={triggerType}
              onChange={(e) => { setTriggerType(e.target.value as TriggerType); setTriggerValue('') }}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              {(Object.entries(TRIGGER_LABELS) as [TriggerType, string][]).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            {triggerType === 'status_changed' ? (
              <select
                value={triggerValue}
                onChange={(e) => setTriggerValue(e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
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
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                <option value="">— pick priority —</option>
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            )}
          </div>

          <div className="flex gap-2 items-center flex-wrap">
            <span className="text-sm text-slate-500 shrink-0">Then</span>
            <select
              value={actionType}
              onChange={(e) => { setActionType(e.target.value as ActionType); setActionValue('') }}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              {(Object.entries(ACTION_LABELS) as [ActionType, string][]).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            {actionType === 'set_status' && (
              <select
                value={actionValue}
                onChange={(e) => setActionValue(e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
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
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                <option value="">— pick priority —</option>
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            )}
            {actionType === 'assign_reviewer' && (
              <input
                value={actionValue}
                onChange={(e) => setActionValue(e.target.value)}
                placeholder="User ID"
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 w-72"
              />
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
    <div className="rounded-lg border border-slate-100 hover:border-slate-200 transition-colors">
      <div className="flex items-center gap-3 py-2 px-3">
        <span className="flex-1 text-sm font-bold text-slate-700">{field.name}</span>
        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{field.field_type}</span>
        {field.is_required && (
          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Required</span>
        )}
        <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer select-none">
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
          className="text-xs text-slate-400 hover:text-violet-600 transition-colors"
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
        <div className="px-3 pb-3 space-y-2 border-t border-slate-100 pt-2">
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
