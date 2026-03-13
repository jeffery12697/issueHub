import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { workspacesApi, useWorkspaceMembers, useInviteMember, useUpdateMemberRole, useRemoveMember } from '@/api/workspaces'
import { useTeams, useCreateTeam, useDeleteTeam, useTeamMembers, useAddTeamMember, useRemoveTeamMember, type TeamRole } from '@/api/teams'
import HeaderActions from '@/components/HeaderActions'
import {
  useListTemplates, useCreateTemplate, useDeleteTemplate, useUpdateTemplate,
  type ListTemplate, type TemplateStatus, type TemplateField,
} from '@/api/listTemplates'

const PRESET_STATUSES: Record<string, TemplateStatus[]> = {
  Basic: [
    { name: 'Todo', color: '#94a3b8', is_complete: false, category: 'not_started', order_index: 0 },
    { name: 'In Progress', color: '#3b82f6', is_complete: false, category: 'active', order_index: 1 },
    { name: 'Done', color: '#22c55e', is_complete: true, category: 'done', order_index: 2 },
  ],
  'Dev workflow': [
    { name: 'Todo', color: '#94a3b8', is_complete: false, category: 'not_started', order_index: 0 },
    { name: 'In Dev', color: '#3b82f6', is_complete: false, category: 'active', order_index: 1 },
    { name: 'Review', color: '#f59e0b', is_complete: false, category: 'active', order_index: 2 },
    { name: 'Done', color: '#22c55e', is_complete: true, category: 'done', order_index: 3 },
    { name: 'Cancelled', color: '#ef4444', is_complete: true, category: 'cancelled', order_index: 4 },
  ],
  Empty: [],
}

const FIELD_TYPES: TemplateField['field_type'][] = ['text', 'number', 'date', 'dropdown', 'checkbox', 'url']

type ActiveTab = 'members' | 'templates' | 'teams'

export default function WorkspaceSettingsPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const [activeTab, setActiveTab] = useState<ActiveTab>('members')

  const { data: workspace } = useQuery({
    queryKey: ['workspace', workspaceId],
    queryFn: () => workspacesApi.get(workspaceId!),
    enabled: !!workspaceId,
  })

  const { data: templates = [] } = useListTemplates(workspaceId)
  const createTemplate = useCreateTemplate(workspaceId!)
  const deleteTemplate = useDeleteTemplate(workspaceId!)
  const updateTemplate = useUpdateTemplate(workspaceId)

  const [showNewTemplate, setShowNewTemplate] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [templatePreset, setTemplatePreset] = useState('Basic')

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 h-14 flex items-center gap-3">
        <Link
          to={`/workspaces/${workspaceId}`}
          className="text-slate-400 hover:text-slate-600 text-sm transition-colors"
        >
          ← Back
        </Link>
        <span className="text-slate-300">/</span>
        <span className="text-sm font-medium text-slate-800">{workspace?.name}</span>
        <span className="text-slate-300">/</span>
        <span className="text-sm font-medium text-slate-500">Settings</span>
        <div className="ml-auto"><HeaderActions /></div>
      </header>

      <main className="max-w-3xl mx-auto py-10 px-6">
        {/* Tab bar */}
        <div className="flex items-center gap-2 mb-6">
          {(['members', 'teams', 'templates'] as ActiveTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors capitalize ${
                activeTab === tab
                  ? 'bg-violet-600 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Members tab */}
        {activeTab === 'members' && workspaceId && (
          <MembersTab workspaceId={workspaceId} />
        )}

        {/* Templates tab */}
        {activeTab === 'templates' && (
          <>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-slate-900">List Templates</h2>
              <button
                onClick={() => setShowNewTemplate(true)}
                className="bg-violet-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-violet-700 transition-colors font-medium"
              >
                + New template
              </button>
            </div>

            {showNewTemplate && (
              <form
                className="mb-6 bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (!templateName.trim()) return
                  createTemplate.mutate(
                    { name: templateName.trim(), default_statuses: PRESET_STATUSES[templatePreset], default_custom_fields: [] },
                    {
                      onSuccess: () => {
                        setShowNewTemplate(false)
                        setTemplateName('')
                        setTemplatePreset('Basic')
                      },
                    }
                  )
                }}
              >
                <div className="flex gap-2">
                  <input
                    autoFocus
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="Template name"
                    className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                  <select
                    value={templatePreset}
                    onChange={(e) => setTemplatePreset(e.target.value)}
                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  >
                    {Object.keys(PRESET_STATUSES).map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowNewTemplate(false)}
                    className="text-sm px-3 py-2 text-slate-500 hover:text-slate-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-violet-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-violet-700 transition-colors"
                  >
                    Create
                  </button>
                </div>
              </form>
            )}

            {templates.length === 0 ? (
              <p className="text-slate-400 text-sm">No templates yet.</p>
            ) : (
              <div className="space-y-3">
                {templates.map((t: ListTemplate) => (
                  <TemplateCard
                    key={t.id}
                    template={t}
                    onDelete={() => deleteTemplate.mutate(t.id)}
                    onUpdate={(data) => updateTemplate.mutate({ templateId: t.id, data })}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* Teams tab */}
        {activeTab === 'teams' && workspaceId && (
          <TeamsTab workspaceId={workspaceId} />
        )}
      </main>
    </div>
  )
}

// ── Members Tab ──────────────────────────────────────────────────────────────

const WORKSPACE_ROLES = ['member', 'admin', 'owner']

function MembersTab({ workspaceId }: { workspaceId: string }) {
  const { data: members = [] } = useWorkspaceMembers(workspaceId)
  const inviteMember = useInviteMember(workspaceId)
  const updateRole = useUpdateMemberRole(workspaceId)
  const removeMember = useRemoveMember(workspaceId)

  const [searchEmail, setSearchEmail] = useState('')
  const [searchResult, setSearchResult] = useState<{ id: string; email: string; display_name: string } | null | undefined>(undefined)
  const [inviteRole, setInviteRole] = useState('member')
  const [searching, setSearching] = useState(false)

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchEmail.trim()) return
    setSearching(true)
    setSearchResult(undefined)
    try {
      const result = await workspacesApi.searchUser(searchEmail.trim())
      setSearchResult(result)
    } finally {
      setSearching(false)
    }
  }

  const handleInvite = () => {
    if (!searchResult) return
    inviteMember.mutate(
      { user_id: searchResult.id, role: inviteRole },
      { onSuccess: () => { setSearchEmail(''); setSearchResult(undefined) } }
    )
  }

  const alreadyMember = searchResult
    ? members.some((m) => m.user_id === searchResult.id)
    : false

  return (
    <div className="space-y-6">
      {/* Add member by email */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Add Member</p>
        <form onSubmit={handleSearch} className="flex gap-2 mb-3">
          <input
            type="email"
            value={searchEmail}
            onChange={(e) => { setSearchEmail(e.target.value); setSearchResult(undefined) }}
            placeholder="Search by email"
            className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
          <button
            type="submit"
            disabled={searching}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm px-4 py-2 rounded-lg transition-colors font-medium disabled:opacity-50"
          >
            {searching ? 'Searching…' : 'Search'}
          </button>
        </form>
        {searchResult === null && (
          <p className="text-sm text-red-400">No user found with that email.</p>
        )}
        {searchResult && (
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-800">{searchResult.display_name}</p>
              <p className="text-xs text-slate-400">{searchResult.email}</p>
            </div>
            {alreadyMember ? (
              <span className="text-xs text-slate-400">Already a member</span>
            ) : (
              <>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  {WORKSPACE_ROLES.map((r) => (
                    <option key={r} value={r} className="capitalize">{r}</option>
                  ))}
                </select>
                <button
                  onClick={handleInvite}
                  className="bg-violet-600 text-white text-sm px-3 py-1.5 rounded-lg hover:bg-violet-700 transition-colors font-medium"
                >
                  Add
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Current members list */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
          Members ({members.length})
        </p>
        <div className="space-y-2">
          {members.map((m) => (
            <div key={m.user_id} className="flex items-center gap-3 py-2 px-3 rounded-lg border border-slate-100">
              <div className="w-8 h-8 rounded-full bg-violet-100 text-violet-700 text-xs font-semibold flex items-center justify-center shrink-0">
                {m.display_name[0]?.toUpperCase()}
              </div>
              <span className="flex-1 text-sm font-medium text-slate-700">{m.display_name}</span>
              <select
                value={m.role}
                onChange={(e) => updateRole.mutate({ userId: m.user_id, role: e.target.value })}
                disabled={m.role === 'owner'}
                className="border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {WORKSPACE_ROLES.map((r) => (
                  <option key={r} value={r} className="capitalize">{r}</option>
                ))}
              </select>
              {m.role !== 'owner' && (
                <button
                  onClick={() => removeMember.mutate(m.user_id)}
                  className="text-xs text-slate-300 hover:text-red-400 transition-colors"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Teams Tab ────────────────────────────────────────────────────────────────

function TeamsTab({ workspaceId }: { workspaceId: string }) {
  const { data: teams = [] } = useTeams(workspaceId)
  const createTeam = useCreateTeam(workspaceId)
  const deleteTeam = useDeleteTeam(workspaceId)
  const { data: wsMembers = [] } = useWorkspaceMembers(workspaceId)

  const [newTeamName, setNewTeamName] = useState('')
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-slate-900">Teams</h2>
      </div>

      {/* Create team form */}
      <form
        className="mb-6 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (!newTeamName.trim()) return
          createTeam.mutate(
            { name: newTeamName.trim() },
            { onSuccess: () => setNewTeamName('') }
          )
        }}
      >
        <input
          value={newTeamName}
          onChange={(e) => setNewTeamName(e.target.value)}
          placeholder="New team name"
          className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
        <button
          type="submit"
          className="bg-violet-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-violet-700 transition-colors font-medium"
        >
          + Create team
        </button>
      </form>

      {teams.length === 0 ? (
        <p className="text-slate-400 text-sm">No teams yet.</p>
      ) : (
        <div className="space-y-3">
          {teams.map((team) => (
            <TeamCard
              key={team.id}
              workspaceId={workspaceId}
              team={team}
              wsMembers={wsMembers}
              expanded={expandedTeam === team.id}
              onToggle={() => setExpandedTeam(expandedTeam === team.id ? null : team.id)}
              onDelete={() => deleteTeam.mutate(team.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

type WsMember = { user_id: string; display_name: string; role: string }

function TeamCard({
  workspaceId,
  team,
  wsMembers,
  expanded,
  onToggle,
  onDelete,
}: {
  workspaceId: string
  team: { id: string; name: string }
  wsMembers: WsMember[]
  expanded: boolean
  onToggle: () => void
  onDelete: () => void
}) {
  const { data: members = [] } = useTeamMembers(workspaceId, team.id)
  const addMember = useAddTeamMember(workspaceId, team.id)
  const removeMember = useRemoveTeamMember(workspaceId, team.id)

  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedRole, setSelectedRole] = useState<TeamRole>('team_member')

  const memberUserIds = new Set(members.map((m) => m.user_id))
  const availableMembers = wsMembers.filter((m) => !memberUserIds.has(m.user_id))

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="flex-1 text-sm font-semibold text-slate-800">{team.name}</span>
        <span className="text-xs text-slate-400">{members.length} member{members.length !== 1 ? 's' : ''}</span>
        <button
          onClick={onToggle}
          className="text-xs text-slate-400 hover:text-violet-600 transition-colors font-medium"
        >
          {expanded ? 'Collapse' : 'Manage'}
        </button>
        <button
          onClick={onDelete}
          className="text-xs text-slate-300 hover:text-red-400 transition-colors"
        >
          Delete
        </button>
      </div>

      {expanded && (
        <div className="border-t border-slate-100 px-4 py-3 space-y-3">
          {/* Member list */}
          {members.length === 0 ? (
            <p className="text-xs text-slate-400">No members yet.</p>
          ) : (
            <div className="space-y-1.5">
              {members.map((m) => (
                <div key={m.user_id} className="flex items-center gap-2 py-1 px-2 rounded-lg bg-slate-50">
                  <span className="flex-1 text-sm text-slate-700">{m.display_name}</span>
                  <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">
                    {m.role === 'team_admin' ? 'Admin' : 'Member'}
                  </span>
                  <button
                    onClick={() => removeMember.mutate(m.user_id)}
                    className="text-xs text-slate-300 hover:text-red-400 transition-colors"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add member form */}
          {availableMembers.length > 0 && (
            <form
              className="flex gap-2 pt-1"
              onSubmit={(e) => {
                e.preventDefault()
                if (!selectedUserId) return
                addMember.mutate(
                  { user_id: selectedUserId, role: selectedRole },
                  { onSuccess: () => setSelectedUserId('') }
                )
              }}
            >
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="flex-1 border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                <option value="">Add member…</option>
                {availableMembers.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.display_name}
                  </option>
                ))}
              </select>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as TeamRole)}
                className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                <option value="team_member">Member</option>
                <option value="team_admin">Admin</option>
              </select>
              <button
                type="submit"
                className="bg-violet-600 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-violet-700 transition-colors font-medium"
              >
                Add
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  )
}

// ── Template management (unchanged) ─────────────────────────────────────────

type EditableStatus = TemplateStatus & { _key: string }
type EditableField = TemplateField & { _key: string }

function TemplateCard({
  template,
  onDelete,
  onUpdate,
}: {
  template: ListTemplate
  onDelete: () => void
  onUpdate: (data: { name?: string; default_statuses?: TemplateStatus[]; default_custom_fields?: TemplateField[] }) => void
}) {
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState(template.name)
  const [showStatusEditor, setShowStatusEditor] = useState(false)
  const [statuses, setStatuses] = useState<EditableStatus[]>(() =>
    template.default_statuses.map((s, i) => ({ ...s, _key: `${i}-${Date.now()}` }))
  )
  const [newStatusName, setNewStatusName] = useState('')
  const [newStatusColor, setNewStatusColor] = useState('#94a3b8')

  const [showFieldEditor, setShowFieldEditor] = useState(false)
  const [fields, setFields] = useState<EditableField[]>(() =>
    (template.default_custom_fields ?? []).map((f, i) => ({ ...f, _key: `f${i}-${Date.now()}` }))
  )
  const [newFieldName, setNewFieldName] = useState('')
  const [newFieldType, setNewFieldType] = useState<TemplateField['field_type']>('text')
  const [newFieldRequired, setNewFieldRequired] = useState(false)
  const [newFieldOptions, setNewFieldOptions] = useState('')

  function handleNameBlur() {
    setEditingName(false)
    if (nameValue.trim() && nameValue.trim() !== template.name) {
      onUpdate({ name: nameValue.trim() })
    }
  }

  function handleStatusChange(key: string, field: keyof TemplateStatus, value: string | boolean | number) {
    setStatuses((prev) =>
      prev.map((s) => (s._key === key ? { ...s, [field]: value } : s))
    )
  }

  function handleDeleteStatus(key: string) {
    setStatuses((prev) => prev.filter((s) => s._key !== key))
  }

  function handleAddStatus() {
    if (!newStatusName.trim()) return
    const newStatus: EditableStatus = {
      name: newStatusName.trim(),
      color: newStatusColor,
      is_complete: false,
      category: 'not_started',
      order_index: statuses.length,
      _key: `new-${Date.now()}`,
    }
    setStatuses((prev) => [...prev, newStatus])
    setNewStatusName('')
    setNewStatusColor('#94a3b8')
  }

  function handleSaveStatuses() {
    const cleaned: TemplateStatus[] = statuses.map(({ _key: _k, ...s }, i) => ({
      ...s,
      order_index: i,
    }))
    onUpdate({ default_statuses: cleaned })
    setShowStatusEditor(false)
  }

  function handleFieldChange(key: string, field: keyof TemplateField, value: string | boolean | number | string[] | null) {
    setFields((prev) =>
      prev.map((f) => (f._key === key ? { ...f, [field]: value } : f))
    )
  }

  function handleFieldOptionsChange(key: string, raw: string) {
    const opts = raw.split('\n').map((s) => s.trim()).filter(Boolean)
    setFields((prev) =>
      prev.map((f) => (f._key === key ? { ...f, options_json: opts.length > 0 ? opts : null } : f))
    )
  }

  function handleDeleteField(key: string) {
    setFields((prev) => prev.filter((f) => f._key !== key))
  }

  function handleAddField() {
    if (!newFieldName.trim()) return
    const newField: EditableField = {
      name: newFieldName.trim(),
      field_type: newFieldType,
      is_required: newFieldRequired,
      options_json: newFieldType === 'dropdown' && newFieldOptions.trim()
        ? newFieldOptions.split('\n').map((s) => s.trim()).filter(Boolean)
        : null,
      order_index: fields.length,
      _key: `fnew-${Date.now()}`,
    }
    setFields((prev) => [...prev, newField])
    setNewFieldName('')
    setNewFieldType('text')
    setNewFieldRequired(false)
    setNewFieldOptions('')
  }

  function handleSaveFields() {
    const cleaned: TemplateField[] = fields.map(({ _key: _k, ...f }, i) => ({
      ...f,
      order_index: i,
    }))
    onUpdate({ default_custom_fields: cleaned })
    setShowFieldEditor(false)
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3 mb-2">
        {editingName ? (
          <input
            autoFocus
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            onBlur={handleNameBlur}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
            className="flex-1 border border-violet-400 rounded-lg px-2 py-1 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        ) : (
          <button
            className="text-sm font-medium text-slate-800 hover:text-violet-700 transition-colors text-left"
            onClick={() => { setEditingName(true); setNameValue(template.name) }}
          >
            {template.name}
          </button>
        )}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowStatusEditor((v) => !v)}
            className="text-xs text-slate-500 hover:text-violet-600 transition-colors font-medium"
          >
            {showStatusEditor ? 'Hide statuses' : 'Edit statuses'}
          </button>
          <button
            onClick={() => setShowFieldEditor((v) => !v)}
            className="text-xs text-slate-500 hover:text-violet-600 transition-colors font-medium"
          >
            {showFieldEditor ? 'Hide fields' : 'Edit fields'}
          </button>
          <button
            onClick={onDelete}
            className="text-xs text-slate-300 hover:text-red-400 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Status pills preview */}
      <div className="flex flex-wrap gap-1.5 mb-1">
        {template.default_statuses.length === 0 ? (
          <span className="text-xs text-slate-400">No statuses</span>
        ) : (
          template.default_statuses.map((s, i) => (
            <span
              key={i}
              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-white"
              style={{ backgroundColor: s.color }}
            >
              {s.name}
            </span>
          ))
        )}
      </div>

      {/* Custom field pills preview */}
      <div className="flex flex-wrap gap-1.5 mb-1">
        {(template.default_custom_fields ?? []).length === 0 ? (
          <span className="text-xs text-slate-400">No custom fields</span>
        ) : (
          (template.default_custom_fields ?? []).map((f, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600"
            >
              {f.name}
              <span className="text-slate-400">{f.field_type}</span>
            </span>
          ))
        )}
      </div>

      {/* Inline status editor */}
      {showStatusEditor && (
        <div className="mt-3 border-t border-slate-100 pt-3 space-y-2">
          {statuses.map((s) => (
            <div key={s._key} className="flex items-center gap-2">
              <input
                type="color"
                value={s.color}
                onChange={(e) => handleStatusChange(s._key, 'color', e.target.value)}
                className="w-7 h-7 rounded cursor-pointer border border-slate-200 p-0.5"
                title="Status color"
              />
              <input
                value={s.name}
                onChange={(e) => handleStatusChange(s._key, 'name', e.target.value)}
                className="flex-1 border border-slate-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                placeholder="Status name"
              />
              <label className="flex items-center gap-1 text-xs text-slate-500 shrink-0">
                <input
                  type="checkbox"
                  checked={s.is_complete}
                  onChange={(e) => handleStatusChange(s._key, 'is_complete', e.target.checked)}
                  className="accent-violet-600"
                />
                Done
              </label>
              <button
                onClick={() => handleDeleteStatus(s._key)}
                className="text-slate-300 hover:text-red-400 text-xs transition-colors shrink-0"
                title="Remove status"
              >
                ✕
              </button>
            </div>
          ))}

          {/* Add status row */}
          <div className="flex items-center gap-2 pt-1">
            <input
              type="color"
              value={newStatusColor}
              onChange={(e) => setNewStatusColor(e.target.value)}
              className="w-7 h-7 rounded cursor-pointer border border-slate-200 p-0.5"
              title="New status color"
            />
            <input
              value={newStatusName}
              onChange={(e) => setNewStatusName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddStatus() }}
              placeholder="New status name"
              className="flex-1 border border-slate-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
            <button
              onClick={handleAddStatus}
              className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors font-medium"
            >
              Add
            </button>
          </div>

          <div className="flex justify-end pt-1">
            <button
              onClick={handleSaveStatuses}
              className="bg-violet-600 text-white text-sm px-4 py-1.5 rounded-lg hover:bg-violet-700 transition-colors font-medium"
            >
              Save
            </button>
          </div>
        </div>
      )}

      {/* Inline field editor */}
      {showFieldEditor && (
        <div className="mt-3 border-t border-slate-100 pt-3 space-y-2">
          {fields.map((f) => (
            <div key={f._key} className="space-y-1">
              <div className="flex items-center gap-2">
                <input
                  value={f.name}
                  onChange={(e) => handleFieldChange(f._key, 'name', e.target.value)}
                  className="flex-1 border border-slate-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  placeholder="Field name"
                />
                <select
                  value={f.field_type}
                  onChange={(e) => handleFieldChange(f._key, 'field_type', e.target.value as TemplateField['field_type'])}
                  className="border border-slate-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  {FIELD_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <label className="flex items-center gap-1 text-xs text-slate-500 shrink-0">
                  <input
                    type="checkbox"
                    checked={f.is_required}
                    onChange={(e) => handleFieldChange(f._key, 'is_required', e.target.checked)}
                    className="accent-violet-600"
                  />
                  Req
                </label>
                <button
                  onClick={() => handleDeleteField(f._key)}
                  className="text-slate-300 hover:text-red-400 text-xs transition-colors shrink-0"
                  title="Remove field"
                >
                  ✕
                </button>
              </div>
              {f.field_type === 'dropdown' && (
                <textarea
                  value={(f.options_json ?? []).join('\n')}
                  onChange={(e) => handleFieldOptionsChange(f._key, e.target.value)}
                  placeholder="One option per line"
                  rows={3}
                  className="w-full border border-slate-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
                />
              )}
            </div>
          ))}

          {/* Add field row */}
          <div className="space-y-1 pt-1">
            <div className="flex items-center gap-2">
              <input
                value={newFieldName}
                onChange={(e) => setNewFieldName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddField() }}
                placeholder="New field name"
                className="flex-1 border border-slate-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
              <select
                value={newFieldType}
                onChange={(e) => setNewFieldType(e.target.value as TemplateField['field_type'])}
                className="border border-slate-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                {FIELD_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <label className="flex items-center gap-1 text-xs text-slate-500 shrink-0">
                <input
                  type="checkbox"
                  checked={newFieldRequired}
                  onChange={(e) => setNewFieldRequired(e.target.checked)}
                  className="accent-violet-600"
                />
                Req
              </label>
              <button
                onClick={handleAddField}
                className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors font-medium"
              >
                Add
              </button>
            </div>
            {newFieldType === 'dropdown' && (
              <textarea
                value={newFieldOptions}
                onChange={(e) => setNewFieldOptions(e.target.value)}
                placeholder="One option per line"
                rows={3}
                className="w-full border border-slate-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
              />
            )}
          </div>

          <div className="flex justify-end pt-1">
            <button
              onClick={handleSaveFields}
              className="bg-violet-600 text-white text-sm px-4 py-1.5 rounded-lg hover:bg-violet-700 transition-colors font-medium"
            >
              Save fields
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
