import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from './client'

export type User = {
  id: string
  email: string
  display_name: string
  avatar_url: string | null
}

export type UserPreferences = {
  notification_preference: 'immediate' | 'digest'
}

export const authApi = {
  me: () => apiClient.get<User>('/auth/me').then((r) => r.data),
  logout: () => apiClient.post('/auth/logout'),
  getPreferences: () => apiClient.get<UserPreferences>('/auth/preferences').then((r) => r.data),
  updatePreferences: (pref: 'immediate' | 'digest') =>
    apiClient.patch<UserPreferences>('/auth/preferences', { notification_preference: pref }).then((r) => r.data),
}

export function usePreferences() {
  return useQuery({
    queryKey: ['preferences'],
    queryFn: authApi.getPreferences,
  })
}

export function useUpdatePreferences() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (pref: 'immediate' | 'digest') => authApi.updatePreferences(pref),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['preferences'] }),
  })
}
