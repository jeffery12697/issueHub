import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { workspacesApi, type Workspace } from '@/api/workspaces'
import { useAuthStore } from '@/store/authStore'
import HeaderActions from '@/components/HeaderActions'

export default function WorkspacePage() {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')

  const { data: workspaces = [], isLoading } = useQuery({
    queryKey: ['workspaces'],
    queryFn: workspacesApi.list,
  })

  const createMutation = useMutation({
    mutationFn: (name: string) => workspacesApi.create(name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workspaces'] })
      setCreating(false)
      setName('')
    },
  })

  const initials = user?.display_name?.charAt(0).toUpperCase() ?? '?'

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-violet-600 rounded-md flex items-center justify-center shrink-0">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <rect x="2" y="4" width="12" height="1.5" rx="0.75" fill="white" />
              <rect x="2" y="7.25" width="9" height="1.5" rx="0.75" fill="white" />
              <rect x="2" y="10.5" width="6" height="1.5" rx="0.75" fill="white" />
            </svg>
          </div>
          <span className="text-base font-bold text-slate-900">IssueHub</span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-600">{user?.display_name}</span>
          <div className="w-8 h-8 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center text-sm font-semibold">
            {initials}
          </div>
          <HeaderActions />
        </div>
      </header>

      <main className="max-w-3xl mx-auto py-12 px-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-slate-900">Workspaces</h2>
          <button
            onClick={() => setCreating(true)}
            className="bg-violet-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-violet-700 transition-colors font-medium"
          >
            New workspace
          </button>
        </div>

        {creating && (
          <form
            className="mb-4 flex gap-2"
            onSubmit={(e) => { e.preventDefault(); createMutation.mutate(name) }}
          >
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Workspace name"
              className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
            <button type="submit" className="bg-violet-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-violet-700 transition-colors">
              Create
            </button>
            <button type="button" onClick={() => setCreating(false)} className="text-sm px-3 py-2 text-slate-500 hover:text-slate-700 transition-colors">
              Cancel
            </button>
          </form>
        )}

        {isLoading ? (
          <p className="text-slate-400 text-sm">Loading...</p>
        ) : workspaces.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-400 text-sm">No workspaces yet. Create one to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {workspaces.map((ws: Workspace) => (
              <Link
                key={ws.id}
                to={`/workspaces/${ws.id}`}
                className="bg-white border border-slate-200 rounded-xl p-4 hover:border-violet-300 hover:shadow-md transition-all flex items-center gap-3"
              >
                <div className="bg-violet-100 text-violet-700 rounded-lg w-10 h-10 flex items-center justify-center text-sm font-bold shrink-0">
                  {ws.name.charAt(0).toUpperCase()}
                </div>
                <span className="text-slate-800 font-medium text-sm">{ws.name}</span>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
