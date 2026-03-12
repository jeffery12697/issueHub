import { apiClient } from './client'

export type User = {
  id: string
  email: string
  display_name: string
  avatar_url: string | null
}

export const authApi = {
  me: () => apiClient.get<User>('/auth/me').then((r) => r.data),
  logout: () => apiClient.post('/auth/logout'),
}
