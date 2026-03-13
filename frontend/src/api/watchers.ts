import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from './client'

export function useWatchStatus(taskId: string | undefined) {
  return useQuery({
    queryKey: ['watch', taskId],
    queryFn: () => apiClient.get<{ watching: boolean }>(`/tasks/${taskId}/watch`).then((r) => r.data),
    enabled: !!taskId,
  })
}

export function useWatchTask(taskId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => apiClient.post(`/tasks/${taskId}/watch`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['watch', taskId] }),
  })
}

export function useUnwatchTask(taskId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => apiClient.delete(`/tasks/${taskId}/watch`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['watch', taskId] }),
  })
}
