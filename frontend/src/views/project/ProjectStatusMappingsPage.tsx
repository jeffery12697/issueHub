import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { projectsApi } from '@/api/projects'
import { listsApi } from '@/api/lists'
import { workspacesApi } from '@/api/workspaces'
import { statusMappingsApi, type StatusMapping } from '@/api/statusMappings'
import HeaderActions from '@/components/HeaderActions'
import { toast } from '@/store/toastStore'

export default function ProjectStatusMappingsPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const qc = useQueryClient()

  const [fromListId, setFromListId] = useState('')
  const [toListId, setToListId] = useState('')

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.get(projectId!),
    enabled: !!projectId,
  })

  const { data: workspace } = useQuery({
    queryKey: ['workspace', project?.workspace_id],
    queryFn: () => workspacesApi.get(project!.workspace_id),
    enabled: !!project?.workspace_id,
  })

  const { data: lists = [] } = useQuery({
    queryKey: ['lists', projectId],
    queryFn: () => listsApi.list(projectId!),
    enabled: !!projectId,
  })

  // Fetch all list details (with statuses) for the summary table
  const { data: listDetails = [] } = useQuery({
    queryKey: ['lists-with-statuses', projectId],
    queryFn: () => Promise.all(lists.map((l) => listsApi.get(l.id))),
    enabled: lists.length > 0,
  })

  const { data: fromListDetail } = useQuery({
    queryKey: ['list', fromListId],
    queryFn: () => listsApi.get(fromListId),
    enabled: !!fromListId,
  })

  const { data: toListDetail } = useQuery({
    queryKey: ['list', toListId],
    queryFn: () => listsApi.get(toListId),
    enabled: !!toListId,
  })

  const { data: mappings = [] } = useQuery({
    queryKey: ['status-mappings', projectId],
    queryFn: () => statusMappingsApi.list(projectId!),
    enabled: !!projectId,
  })

  const upsert = useMutation({
    mutationFn: ({ fromStatusId, toStatusId }: { fromStatusId: string; toStatusId: string }) =>
      statusMappingsApi.upsert(projectId!, {
        from_list_id: fromListId,
        from_status_id: fromStatusId,
        to_list_id: toListId,
        to_status_id: toStatusId,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['status-mappings', projectId] }),
    onError: () => toast.error('Failed to save mapping'),
  })

  const remove = useMutation({
    mutationFn: (mappingId: string) => statusMappingsApi.delete(projectId!, mappingId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['status-mappings', projectId] }),
    onError: () => toast.error('Failed to remove mapping'),
  })

  const fromStatuses = fromListDetail?.statuses ?? []
  const toStatuses = toListDetail?.statuses ?? []

  // Build a lookup: fromStatusId → mapping (for the current from/to pair)
  const pairMappings = new Map<string, StatusMapping>()
  for (const m of mappings) {
    if (m.from_list_id === fromListId && m.to_list_id === toListId) {
      pairMappings.set(m.from_status_id, m)
    }
  }

  function handleMappingChange(fromStatusId: string, toStatusId: string) {
    if (!toStatusId) {
      // Remove mapping if exists
      const existing = pairMappings.get(fromStatusId)
      if (existing) remove.mutate(existing.id)
    } else {
      upsert.mutate({ fromStatusId, toStatusId })
    }
  }

  // Summary: count how many list pairs have mappings
  const configuredPairs = new Set(mappings.map((m) => `${m.from_list_id}→${m.to_list_id}`)).size

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-6 h-16 flex items-center gap-4">
        <Link to="/" className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 text-sm transition-colors shrink-0">← Home</Link>
        {workspace && (
          <>
            <span className="text-slate-200 dark:text-slate-700 shrink-0">/</span>
            <Link
              to={`/workspaces/${workspace.id}`}
              className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-violet-600 bg-slate-100 dark:bg-slate-800 hover:bg-violet-50 dark:hover:bg-violet-950 px-2 py-0.5 rounded-md truncate max-w-[140px] transition-colors"
            >
              {workspace.name}
            </Link>
          </>
        )}
        <span className="text-slate-200 dark:text-slate-700 shrink-0">/</span>
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[160px]">{project?.name}</span>
        <nav className="flex items-center gap-1 ml-2">
          <Link to={`/projects/${projectId}`} className="px-3.5 py-2 rounded-lg text-sm font-medium transition-colors text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800">
            All Tasks
          </Link>
          <Link to={`/projects/${projectId}/gantt`} className="px-3.5 py-2 rounded-lg text-sm font-medium transition-colors text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800">
            Timeline
          </Link>
          <Link to={`/projects/${projectId}/analytics`} className="px-3.5 py-2 rounded-lg text-sm font-medium transition-colors text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800">
            Analytics
          </Link>
          <Link to={`/projects/${projectId}/status-mappings`} className="px-3.5 py-2 rounded-lg text-sm font-medium transition-colors bg-violet-50 dark:bg-violet-950 text-violet-700 dark:text-violet-300">
            Status Mappings
          </Link>
        </nav>
        <div className="ml-auto"><HeaderActions /></div>
      </header>

      <main className="max-w-3xl mx-auto py-10 px-6">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Status Mappings</h1>
          <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
            When a task is moved between lists, apply these rules to preserve its progress context.
            {configuredPairs > 0 && (
              <span className="ml-1 text-violet-500 font-medium">{configuredPairs} pair{configuredPairs !== 1 ? 's' : ''} configured.</span>
            )}
          </p>
        </div>

        {/* List pair selector */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm p-5 mb-6">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Configure a list pair</h2>
          <div className="flex items-center gap-3">
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
            <span className="text-slate-400 dark:text-slate-500 text-lg mt-5">→</span>
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

        {/* Mapping table */}
        {fromListId && toListId && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {fromListDetail?.name} → {toListDetail?.name}
              </p>
            </div>
            {fromStatuses.length === 0 ? (
              <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-8">No statuses in the source list.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-1/2">
                      Status in <span className="normal-case font-bold text-slate-700 dark:text-slate-300">{fromListDetail?.name}</span>
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-1/2">
                      Maps to in <span className="normal-case font-bold text-slate-700 dark:text-slate-300">{toListDetail?.name}</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {fromStatuses.map((fromStatus) => {
                    const existing = pairMappings.get(fromStatus.id)
                    return (
                      <tr key={fromStatus.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="px-5 py-3">
                          <span
                            className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
                            style={{ backgroundColor: fromStatus.color + '20', color: fromStatus.color }}
                          >
                            {fromStatus.name}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <select
                            value={existing?.to_status_id ?? ''}
                            onChange={(e) => handleMappingChange(fromStatus.id, e.target.value)}
                            className="h-8 text-xs border border-slate-200 dark:border-slate-700 rounded-lg px-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-500 min-w-[160px]"
                          >
                            <option value="">— No mapping (clear status)</option>
                            {toStatuses.map((toStatus) => (
                              <option key={toStatus.id} value={toStatus.id}>{toStatus.name}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {!fromListId || !toListId ? (
          <div className="text-center py-16 bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
            <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">Select a list pair above to configure mappings.</p>
            <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">Mappings are applied automatically when tasks are moved between lists.</p>
          </div>
        ) : null}

        {/* All configured mappings summary */}
        {mappings.length > 0 && (
          <div className="mt-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">All configured mappings</p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">From</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">To</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {mappings.map((m) => {
                  const fromList = lists.find((l) => l.id === m.from_list_id)
                  const toList = lists.find((l) => l.id === m.to_list_id)
                  const fromListStatuses = fromList
                    ? (listDetails.find((l) => l.id === fromList.id)?.statuses ?? [])
                    : []
                  const toListStatuses = toList
                    ? (listDetails.find((l) => l.id === toList.id)?.statuses ?? [])
                    : []
                  const fromStatus = fromListStatuses.find((s) => s.id === m.from_status_id)
                  const toStatus = toListStatuses.find((s) => s.id === m.to_status_id)
                  return (
                    <tr key={m.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-5 py-3">
                        <span className="text-xs text-slate-400 dark:text-slate-500">{fromList?.name} /</span>
                        {fromStatus && (
                          <span
                            className="ml-1.5 inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: fromStatus.color + '20', color: fromStatus.color }}
                          >
                            {fromStatus.name}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-xs text-slate-400 dark:text-slate-500">{toList?.name} /</span>
                        {toStatus && (
                          <span
                            className="ml-1.5 inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: toStatus.color + '20', color: toStatus.color }}
                          >
                            {toStatus.name}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => remove.mutate(m.id)}
                          className="text-slate-300 dark:text-slate-600 hover:text-red-500 text-xs transition-colors"
                          title="Remove mapping"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}
