import axios from 'axios'
import { toast } from '@/store/toastStore'

export const apiClient = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
})

// Inject access token on every request
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// On 401 — try to refresh, else redirect to login
apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      try {
        const { data } = await axios.post('/api/v1/auth/refresh', {}, { withCredentials: true })
        localStorage.setItem('access_token', data.access_token)
        original.headers.Authorization = `Bearer ${data.access_token}`
        return apiClient(original)
      } catch {
        localStorage.removeItem('access_token')
        window.location.href = '/login'
      }
    }
    // Extract a readable message from the error response
    const data = error.response?.data
    const status = error.response?.status

    // Don't show a toast for 401 (handled above) or if no response
    if (status && status !== 401) {
      let message = 'Something went wrong.'
      if (typeof data?.detail === 'string') {
        message = data.detail
      } else if (Array.isArray(data?.detail)) {
        // FastAPI 422 validation errors: [{loc, msg, type}]
        message = data.detail.map((e: { loc: string[]; msg: string }) =>
          `${e.loc.at(-1)}: ${e.msg}`
        ).join('\n')
      }
      toast.error(message)
    }

    return Promise.reject(error)
  },
)
