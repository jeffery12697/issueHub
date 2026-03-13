import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { workspacesApi, type Workspace } from '@/api/workspaces'
import { useAuthStore } from '@/store/authStore'
import HeaderActions from '@/components/HeaderActions'

const AVATAR_COLORS = [
  ['bg-violet-500', 'text-white'],
  ['bg-sky-500', 'text-white'],
  ['bg-emerald-500', 'text-white'],
  ['bg-amber-500', 'text-white'],
  ['bg-rose-500', 'text-white'],
  ['bg-indigo-500', 'text-white'],
]

function avatarColor(name: string) {
  const idx = name.charCodeAt(0) % AVATAR_COLORS.length
  return AVATAR_COLORS[idx]
}

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

  const greeting = getGreeting()

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
        <HeaderActions />
      </header>

      <main className="max-w-3xl mx-auto py-12 px-6">
        {/* Greeting */}
        <div className="mb-10">
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1">{greeting}</p>
          <h1 className="text-2xl font-bold text-slate-900">
            {user?.display_name ? `${user.display_name}` : 'Welcome back'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {workspaces.length === 0
              ? 'Create a workspace to get started.'
              : `You have ${workspaces.length} workspace${workspaces.length === 1 ? '' : 's'}.`}
          </p>
        </div>

        {/* Header row */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Workspaces</h2>
          {!creating && (
            <button
              onClick={() => setCreating(true)}
              className="flex items-center gap-1.5 bg-violet-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-violet-700 transition-colors font-medium"
            >
              <span className="text-base leading-none">+</span> New workspace
            </button>
          )}
        </div>

        {/* Create form */}
        {creating && (
          <form
            className="mb-4 bg-white border border-violet-200 rounded-xl p-4 shadow-sm flex gap-2"
            onSubmit={(e) => { e.preventDefault(); createMutation.mutate(name) }}
          >
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Workspace name"
              className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
            <button
              type="submit"
              disabled={!name.trim()}
              className="bg-violet-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-violet-700 transition-colors disabled:opacity-50"
            >
              Create
            </button>
            <button
              type="button"
              onClick={() => { setCreating(false); setName('') }}
              className="text-sm px-3 py-2 text-slate-500 hover:text-slate-700 transition-colors"
            >
              Cancel
            </button>
          </form>
        )}

        {/* Content */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="bg-white border border-slate-200 rounded-xl h-20 animate-pulse" />
            ))}
          </div>
        ) : workspaces.length === 0 ? (
          <div className="text-center py-20 bg-white border border-dashed border-slate-200 rounded-2xl">
            <div className="w-12 h-12 bg-violet-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-violet-400">
                <rect x="3" y="3" width="18" height="18" rx="3" />
                <path d="M12 8v8M8 12h8" />
              </svg>
            </div>
            <p className="text-slate-700 font-medium mb-1">No workspaces yet</p>
            <p className="text-slate-400 text-sm mb-5">Create a workspace to start tracking your work.</p>
            <button
              onClick={() => setCreating(true)}
              className="bg-violet-600 text-white text-sm px-5 py-2 rounded-lg hover:bg-violet-700 transition-colors font-medium"
            >
              Create workspace
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {workspaces.map((ws: Workspace) => {
              const [bg, fg] = avatarColor(ws.name)
              return (
                <Link
                  key={ws.id}
                  to={`/workspaces/${ws.id}`}
                  className="group bg-white border border-slate-200 rounded-xl p-5 hover:border-violet-300 hover:shadow-md transition-all flex items-center gap-4"
                >
                  <div className={`${bg} ${fg} rounded-xl w-12 h-12 flex items-center justify-center text-lg font-bold shrink-0 shadow-sm`}>
                    {ws.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-900 font-semibold text-sm truncate group-hover:text-violet-700 transition-colors">
                      {ws.name}
                    </p>
                    <p className="text-slate-400 text-xs mt-0.5">Open workspace →</p>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}
