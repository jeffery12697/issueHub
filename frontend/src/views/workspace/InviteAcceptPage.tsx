import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { workspacesApi, useAcceptInvite } from '@/api/workspaces'
import { useAuthStore } from '@/store/authStore'

export default function InviteAcceptPage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const currentUser = useAuthStore((s) => s.user)
  const acceptInvite = useAcceptInvite()
  const [accepted, setAccepted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { data: invite, isLoading, isError } = useQuery({
    queryKey: ['invite', token],
    queryFn: () => workspacesApi.getInvite(token!),
    enabled: !!token,
    retry: false,
  })

  function handleAccept() {
    if (!token) return
    acceptInvite.mutate(token, {
      onSuccess: () => {
        setAccepted(true)
        setTimeout(() => navigate('/'), 2000)
      },
      onError: (err: unknown) => {
        const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        setError(msg ?? 'Failed to accept invite.')
      },
    })
  }

  if (isLoading) {
    return <PageShell><p className="text-slate-500 text-sm">Loading invite…</p></PageShell>
  }

  if (isError || !invite) {
    return (
      <PageShell>
        <p className="text-red-500 font-medium mb-1">Invite not found</p>
        <p className="text-slate-400 text-sm">This invite link is invalid or has expired.</p>
      </PageShell>
    )
  }

  const isExpired = new Date(invite.expires_at) < new Date()

  if (accepted) {
    return (
      <PageShell>
        <div className="text-green-600 text-4xl mb-3">✓</div>
        <p className="text-slate-800 font-semibold text-lg mb-1">You're in!</p>
        <p className="text-slate-400 text-sm">Redirecting you to the workspace…</p>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <div className="text-3xl mb-4">✉️</div>
      <h1 className="text-xl font-bold text-slate-900 mb-1">Workspace invitation</h1>
      <p className="text-slate-500 text-sm mb-6">
        You've been invited to join a workspace as <strong className="text-slate-700 capitalize">{invite.role}</strong>.
      </p>

      {invite.accepted_at && (
        <p className="text-sm text-slate-400 bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 mb-4">
          This invite has already been accepted.
        </p>
      )}

      {isExpired && !invite.accepted_at && (
        <p className="text-sm text-red-400 bg-red-50 border border-red-100 rounded-lg px-4 py-2 mb-4">
          This invite has expired.
        </p>
      )}

      {error && (
        <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-lg px-4 py-2 mb-4">{error}</p>
      )}

      {!invite.accepted_at && !isExpired && currentUser && currentUser.email !== invite.email && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
          This invite was sent to <strong>{invite.email}</strong>, but you're signed in as <strong>{currentUser.email}</strong>.
          Please sign in with the correct account to accept.
        </div>
      )}

      {!invite.accepted_at && !isExpired && currentUser?.email === invite.email && (
        <button
          onClick={handleAccept}
          disabled={acceptInvite.isPending}
          className="bg-violet-600 text-white font-semibold px-6 py-2.5 rounded-lg hover:bg-violet-700 transition-colors disabled:opacity-50"
        >
          {acceptInvite.isPending ? 'Accepting…' : 'Accept invitation'}
        </button>
      )}

      {(invite.accepted_at || isExpired) && (
        <button
          onClick={() => navigate('/')}
          className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
        >
          Go to workspace →
        </button>
      )}
    </PageShell>
  )
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm px-10 py-12 max-w-md w-full text-center">
        <div className="text-xl font-bold text-slate-900 mb-6 flex items-center justify-center gap-2">
          <span>&#9680;</span> IssueHub
        </div>
        {children}
      </div>
    </div>
  )
}
