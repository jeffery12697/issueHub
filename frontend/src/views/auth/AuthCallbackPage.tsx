import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'

export default function AuthCallbackPage() {
  const [params] = useSearchParams()
  const { setAccessToken } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    const token = params.get('access_token')
    if (token) {
      setAccessToken(token)
      navigate('/', { replace: true })
    } else {
      navigate('/login', { replace: true })
    }
  }, [params, setAccessToken, navigate])

  return (
    <div className="flex items-center justify-center h-screen bg-slate-50 dark:bg-slate-900">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-slate-200 dark:bg-slate-700 animate-pulse" />
        <div className="w-28 h-3.5 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" />
      </div>
    </div>
  )
}
