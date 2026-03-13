import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from './client'

export interface TaskLink {
  id: string
  task_id: string
  created_by: string
  url: string
  title: string | null
}

export function useTaskLinks(taskId: string | undefined) {
  return useQuery<TaskLink[]>({
    queryKey: ['links', taskId],
    queryFn: () => apiClient.get(`/tasks/${taskId}/links`).then((r) => r.data),
    enabled: !!taskId,
  })
}

export function useAddLink(taskId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { url: string; title?: string }) =>
      apiClient.post(`/tasks/${taskId}/links`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['links', taskId] })
      qc.invalidateQueries({ queryKey: ['audit', taskId] })
    },
  })
}

export function useDeleteLink(taskId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (linkId: string) =>
      apiClient.delete(`/tasks/${taskId}/links/${linkId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['links', taskId] })
      qc.invalidateQueries({ queryKey: ['audit', taskId] })
    },
  })
}
