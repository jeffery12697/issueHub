import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { projectsApi } from '@/api/projects'
import { listsApi, type ListStatus } from '@/api/lists'
import { statusMappingsApi, type StatusMapping } from '@/api/statusMappings'
import HeaderActions from '@/components/HeaderActions'
import { toast } from '@/store/toastStore'

export default function ProjectSettingsPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [activeTab, setActiveTab] = useState<'status-mappings'>('status-mappings')

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

  const { data: listDetails = [] } = useQuery({
    queryKey: ['lists-with-statuses', projectId],
    queryFn: () => Promise.all(lists.map((l) => listsApi.get(l.id))),
    enabled: lists.length > 0,
  })

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-4 sm:px-6 h-14 flex items-center gap-3">
        <Link
          to={`/projects/${projectId}`}
          className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 text-sm transition-colors"
        >
          ← Back to project
        </Link>
        <span className="text-slate-300 dark:text-slate-600">/</span>
        <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{project?.name}</span>
        <span className="text-slate-300 dark:text-slate-600">/</span>
        <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Settings</span>
        <div className="ml-auto"><HeaderActions /></div>
      </header>

      <main className="max-w-3xl mx-auto py-8 sm:py-10 px-4 sm:px-6">
        <div className="flex items-center gap-2 mb-6">
          <button
            onClick={() => setActiveTab('status-mappings')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              activeTab === 'status-mappings'
                ? 'bg-violet-600 text-white'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            Status Mappings
          </button>
        </div>

        {activeTab === 'status-mappings' && projectId && (
          <StatusMappingsTab
            projectId={projectId}
            lists={lists}
            listDetails={listDetails}
          />
        )}
      </main>
    </div>
  )
}

type ListBasic = { id: string; name: string }
type ListWithStatuses = ListBasic & { statuses?: ListStatus[] }

function StatusMappingsTab({
  projectId,
  lists,
  listDetails,
}: {
  projectId: string
  lists: ListBasic[]
  listDetails: ListWithStatuses[]
}) {
  const qc = useQueryClient()
  const [fromListId, setFromListId] = useState('')
  const [toListId, setToListId] = useState('')

  const { data: mappings = [] } = useQuery({
    queryKey: ['status-mappings', projectId],
    queryFn: () => statusMappingsApi.list(projectId),
  })

  const upsert = useMutation({
    mutationFn: ({ fromStatusId, toStatusId }: { fromStatusId: string; toStatusId: string }) =>
      statusMappingsApi.upsert(projectId, {
        from_list_id: fromListId,
        from_status_id: fromStatusId,
        to_list_id: toListId,
        to_status_id: toStatusId,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['status-mappings', projectId] }),
    onError: () => toast.error('Failed to save mapping'),
  })

  const remove = useMutation({
    mutationFn: (mappingId: string) => statusMappingsApi.delete(projectId, mappingId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['status-mappings', projectId] }),
    onError: () => toast.error('Failed to remove mapping'),
  })

  const fromListDetail = listDetails.find((l) => l.id === fromListId)
  const toListDetail = listDetails.find((l) => l.id === toListId)
  const fromStatuses = fromListDetail?.statuses ?? []
  const toStatuses = toListDetail?.statuses ?? []

  const pairMappings = new Map<string, StatusMapping>()
  for (const m of mappings) {
    if (m.from_list_id === fromListId && m.to_list_id === toListId) {
      pairMappings.set(m.from_status_id, m)
    }
  }

  function handleMappingChange(fromStatusId: string, toStatusId: string) {
    if (!toStatusId) {
      const existing = pairMappings.get(fromStatusId)
      if (existing) remove.mutate(existing.id)
    } else {
      upsert.mutate({ fromStatusId, toStatusId })
    }
  }

  return (
    <div className="space-y-4">
      {/* Description */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm p-5">
        <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 block">
          Status Mappings
        </label>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          When a task is moved between lists, these rules preserve its progress context by mapping the old status to the equivalent status in the destination list.
        </p>
      </div>

      {/* List pair picker */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm p-5">
        <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4 block">
          Configure a list pair
        </label>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">From list</label>
            <select
              value={fromListId}
              onChange={(e) => { setFromListId(e.target.value); if (e.target.value === toListId) setToListId('') }}
              className="w-full h-9 text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-3 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              <option value="">Select list…</option>
              {lists.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>
          <span className="text-slate-400 dark:text-slate-500 text-lg pb-1">→</span>
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">To list</label>
            <select
              value={toListId}
              onChange={(e) => setToListId(e.target.value)}
              className="w-full h-9 text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-3 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              <option value="">Select list…</option>
              {lists.filter((l) => l.id !== fromListId).map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Mapping rows */}
      {fromListId && toListId && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm p-5">
          <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4 block">
            {fromListDetail?.name} → {toListDetail?.name}
          </label>
          {fromStatuses.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500">No statuses in the source list.</p>
          ) : (
            <div className="space-y-2">
              {fromStatuses.map((fromStatus) => {
                const existing = pairMappings.get(fromStatus.id)
                return (
                  <div
                    key={fromStatus.id}
                    className="flex items-center gap-3 py-2 px-3 rounded-lg border border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 transition-colors"
                  >
                    <span
                      className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 min-w-[100px]"
                      style={{ backgroundColor: fromStatus.color + '20', color: fromStatus.color }}
                    >
                      {fromStatus.name}
                    </span>
                    <span className="text-slate-300 dark:text-slate-600 text-sm shrink-0">→</span>
                    <select
                      value={existing?.to_status_id ?? ''}
                      onChange={(e) => handleMappingChange(fromStatus.id, e.target.value)}
                      className="flex-1 h-8 text-xs border border-slate-200 dark:border-slate-700 rounded-lg px-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-500"
                    >
                      <option value="">— No mapping (clear status)</option>
                      {toStatuses.map((toStatus) => (
                        <option key={toStatus.id} value={toStatus.id}>{toStatus.name}</option>
                      ))}
                    </select>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {(!fromListId || !toListId) && (
        <p className="text-center text-sm text-slate-400 dark:text-slate-500 py-4">
          Select a list pair above to configure mappings.
        </p>
      )}

      {/* All mappings summary */}
      {mappings.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm p-5">
          <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4 block">
            All configured mappings
          </label>
          <div className="space-y-2">
            {mappings.map((m) => {
              const fromList = lists.find((l) => l.id === m.from_list_id)
              const toList = lists.find((l) => l.id === m.to_list_id)
              const fromStatuses2 = listDetails.find((l) => l.id === m.from_list_id)?.statuses ?? []
              const toStatuses2 = listDetails.find((l) => l.id === m.to_list_id)?.statuses ?? []
              const fromStatus = fromStatuses2.find((s) => s.id === m.from_status_id)
              const toStatus = toStatuses2.find((s) => s.id === m.to_status_id)
              return (
                <div
                  key={m.id}
                  className="flex items-center gap-3 py-2 px-3 rounded-lg border border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 transition-colors"
                >
                  <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0">{fromList?.name}</span>
                  {fromStatus && (
                    <span
                      className="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full shrink-0"
                      style={{ backgroundColor: fromStatus.color + '20', color: fromStatus.color }}
                    >
                      {fromStatus.name}
                    </span>
                  )}
                  <span className="text-slate-300 dark:text-slate-600 text-sm shrink-0">→</span>
                  <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0">{toList?.name}</span>
                  {toStatus && (
                    <span
                      className="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full shrink-0"
                      style={{ backgroundColor: toStatus.color + '20', color: toStatus.color }}
                    >
                      {toStatus.name}
                    </span>
                  )}
                  <button
                    onClick={() => remove.mutate(m.id)}
                    className="ml-auto text-slate-300 dark:text-slate-600 hover:text-red-500 text-xs transition-colors"
                    title="Remove mapping"
                  >
                    ✕
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
