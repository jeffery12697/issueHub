import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import axios from 'axios'

export default function LoginPage() {
  const navigate = useNavigate()
  const { setAccessToken, setUser } = useAuthStore()

  const devLogin = async () => {
    const { data: { access_token } } = await axios.post('/api/v1/dev/token')
    setAccessToken(access_token)
    const { data: user } = await axios.get('/api/v1/auth/me', {
      headers: { Authorization: `Bearer ${access_token}` },
    })
    setUser(user)
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 to-slate-100 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-10 w-full max-w-sm">
        {/* Logo area */}
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 bg-violet-600 rounded-lg flex items-center justify-center shrink-0">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="2" y="4" width="12" height="1.5" rx="0.75" fill="white" />
              <rect x="2" y="7.25" width="9" height="1.5" rx="0.75" fill="white" />
              <rect x="2" y="10.5" width="6" height="1.5" rx="0.75" fill="white" />
            </svg>
          </div>
          <span className="text-2xl font-bold text-slate-900">IssueHub</span>
        </div>

        <p className="text-slate-500 text-sm mb-8">Track work. Ship faster.</p>

        <a
          href="/api/v1/auth/google/redirect"
          className="flex items-center justify-center gap-3 w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
        >
          <GoogleIcon />
          Continue with Google
        </a>

        <div className="mt-4 pt-4 border-t border-slate-100 text-center">
          <button
            onClick={devLogin}
            className="text-sm text-slate-400 hover:text-slate-600 transition-colors py-1"
          >
            Dev login (skip Google)
          </button>
        </div>
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
      <path fill="#FBBC05" d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.548 0 9s.348 2.825.957 4.039l3.007-2.332z"/>
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z"/>
    </svg>
  )
}
