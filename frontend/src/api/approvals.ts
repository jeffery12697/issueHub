import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from './client'

export interface Approval {
  user_id: string
  display_name: string
  avatar_url: string | null
  approved_at: string
}

export function useTaskApprovals(taskId: string | undefined) {
  return useQuery<Approval[]>({
    queryKey: ['approvals', taskId],
    queryFn: () => apiClient.get(`/tasks/${taskId}/approvals`).then((r) => r.data),
    enabled: !!taskId,
  })
}

export function useApproveTask(taskId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => apiClient.post(`/tasks/${taskId}/approve`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['approvals', taskId] })
      qc.invalidateQueries({ queryKey: ['audit', taskId] })
    },
  })
}

export function useRevokeApproval(taskId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => apiClient.delete(`/tasks/${taskId}/approve`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['approvals', taskId] })
      qc.invalidateQueries({ queryKey: ['audit', taskId] })
    },
  })
}
