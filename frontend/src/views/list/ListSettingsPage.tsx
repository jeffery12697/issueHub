import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listsApi, type ListStatus } from '@/api/lists'
import { useFieldDefinitions, useCreateField, useDeleteField, useUpdateField, type FieldType, type FieldDefinition } from '@/api/customFields'
import HeaderActions from '@/components/HeaderActions'

export default function ListSettingsPage() {
  const { projectId, listId } = useParams<{ projectId: string; listId: string }>()
  const [activeTab, setActiveTab] = useState<'statuses' | 'custom-fields'>('statuses')

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
        </div>

        {activeTab === 'statuses' && listId && (
          <StatusesTab listId={listId} statuses={list?.statuses ?? []} />
        )}
        {activeTab === 'custom-fields' && listId && (
          <CustomFieldsTab listId={listId} />
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

      <button
        onClick={onDelete}
        className="text-slate-300 hover:text-red-400 text-xs transition-colors"
      >
        Delete
      </button>
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
        <button onClick={onDelete} className="text-slate-300 hover:text-red-400 text-xs transition-colors">
          Delete
        </button>
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
