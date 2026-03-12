import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { workspacesApi, type Workspace } from '@/api/workspaces'
import { useAuthStore } from '@/store/authStore'

export default function WorkspacePage() {
  const { user, logout } = useAuthStore()
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

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">IssueHub</h1>
        <div className="flex items-center gap-3 text-sm text-gray-600">
          <span>{user?.display_name}</span>
          <button onClick={logout} className="text-gray-400 hover:text-gray-600">Sign out</button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto py-12 px-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Workspaces</h2>
          <button
            onClick={() => setCreating(true)}
            className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
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
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button type="submit" className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700">
              Create
            </button>
            <button type="button" onClick={() => setCreating(false)} className="text-sm px-3 py-2 text-gray-500 hover:text-gray-700">
              Cancel
            </button>
          </form>
        )}

        {isLoading ? (
          <p className="text-gray-400 text-sm">Loading...</p>
        ) : workspaces.length === 0 ? (
          <p className="text-gray-400 text-sm">No workspaces yet. Create one to get started.</p>
        ) : (
          <ul className="space-y-2">
            {workspaces.map((ws: Workspace) => (
              <li key={ws.id}>
                <Link
                  to={`/workspaces/${ws.id}`}
                  className="block bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm font-medium text-gray-800 hover:border-blue-300 hover:bg-blue-50 transition-colors"
                >
                  {ws.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}
