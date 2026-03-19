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
        <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-950 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500" aria-hidden="true">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <p className="text-slate-800 dark:text-slate-200 font-semibold text-lg mb-1">You're in!</p>
        <p className="text-slate-500 dark:text-slate-400 text-sm">Redirecting you to the workspace…</p>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <div className="w-12 h-12 bg-violet-50 dark:bg-violet-950 rounded-2xl flex items-center justify-center mx-auto mb-4">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-violet-400" aria-hidden="true">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
          <polyline points="22,6 12,13 2,6" />
        </svg>
      </div>
      <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-1">Workspace invitation</h1>
      <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
        You've been invited to join a workspace as <strong className="text-slate-700 dark:text-slate-300 capitalize">{invite.role}</strong>.
      </p>

      {invite.accepted_at && (
        <p className="text-sm text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 mb-4">
          This invite has already been accepted.
        </p>
      )}

      {isExpired && !invite.accepted_at && (
        <p className="text-sm text-red-400 bg-red-50 dark:bg-red-950 border border-red-100 dark:border-red-900 rounded-lg px-4 py-2 mb-4">
          This invite has expired.
        </p>
      )}

      {error && (
        <p className="text-sm text-red-500 bg-red-50 dark:bg-red-950 border border-red-100 dark:border-red-900 rounded-lg px-4 py-2 mb-4">{error}</p>
      )}

      {!invite.accepted_at && !isExpired && currentUser && currentUser.email !== invite.email && (
        <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-700 dark:text-amber-400">
          This invite was sent to <strong>{invite.email}</strong>, but you're signed in as <strong>{currentUser.email}</strong>.
          Please sign in with the correct account to accept.
        </div>
      )}

      {!invite.accepted_at && !isExpired && currentUser?.email === invite.email && (
        <button
          onClick={handleAccept}
          disabled={acceptInvite.isPending}
          className="bg-violet-600 text-white font-semibold px-6 py-2.5 rounded-lg hover:bg-violet-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {acceptInvite.isPending ? 'Accepting…' : 'Accept invitation'}
        </button>
      )}

      {(invite.accepted_at || isExpired) && (
        <button
          onClick={() => navigate('/')}
          className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
        >
          Go to workspace →
        </button>
      )}
    </PageShell>
  )
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm px-10 py-12 max-w-md w-full text-center">
        <div className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-6 flex items-center justify-center gap-2.5">
          <div className="w-7 h-7 bg-violet-600 rounded-md flex items-center justify-center shrink-0" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <rect x="2" y="4" width="12" height="1.5" rx="0.75" fill="white" />
              <rect x="2" y="7.25" width="9" height="1.5" rx="0.75" fill="white" />
              <rect x="2" y="10.5" width="6" height="1.5" rx="0.75" fill="white" />
            </svg>
          </div>
          IssueHub
        </div>
        {children}
      </div>
    </div>
  )
}
