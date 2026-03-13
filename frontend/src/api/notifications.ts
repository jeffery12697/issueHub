import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from './client'

export type Notification = {
  id: string
  user_id: string
  task_id: string
  type: 'mention' | 'assigned' | 'unblocked'
  body: string
  is_read: boolean
  meta: Record<string, string>
  created_at: string
}

export const notificationsApi = {
  list: () => apiClient.get<Notification[]>('/users/me/notifications').then(r => r.data),
  unreadCount: () => apiClient.get<{ count: number }>('/users/me/notifications/unread-count').then(r => r.data),
  markRead: (id: string) => apiClient.patch(`/users/me/notifications/${id}/read`),
  markAllRead: () => apiClient.patch('/users/me/notifications/read-all'),
}

export function useNotifications() {
  return useQuery({ queryKey: ['notifications'], queryFn: notificationsApi.list })
}

export function useUnreadCount() {
  return useQuery({
    queryKey: ['notifications-unread'],
    queryFn: notificationsApi.unreadCount,
    refetchInterval: 30000, // poll every 30s as fallback
  })
}

export function useMarkRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: notificationsApi.markRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
      qc.invalidateQueries({ queryKey: ['notifications-unread'] })
    },
  })
}

export function useMarkAllRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
      qc.invalidateQueries({ queryKey: ['notifications-unread'] })
    },
  })
}
