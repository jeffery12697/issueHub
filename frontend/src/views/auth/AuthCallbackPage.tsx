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
    <div className="flex items-center justify-center h-screen text-gray-500">
      Signing in...
    </div>
  )
}
