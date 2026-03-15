import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from './client'

export type TimeEntry = {
  id: string
  task_id: string
  user_id: string
  duration_minutes: number
  note: string | null
  logged_at: string
}

export type TimeEntrySummary = {
  entries: TimeEntry[]
  total_minutes: number
}

export function useTimeEntries(taskId: string | undefined) {
  return useQuery({
    queryKey: ['time-entries', taskId],
    queryFn: () => apiClient.get<TimeEntrySummary>(`/tasks/${taskId}/time-entries`).then((r) => r.data),
    enabled: !!taskId,
  })
}

export function useLogTime(taskId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { duration_minutes: number; note?: string }) =>
      apiClient.post<TimeEntry>(`/tasks/${taskId}/time-entries`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['time-entries', taskId] })
      qc.invalidateQueries({ queryKey: ['audit', taskId] })
    },
  })
}

export function useDeleteTimeEntry(taskId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (entryId: string) => apiClient.delete(`/tasks/${taskId}/time-entries/${entryId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['time-entries', taskId] }),
  })
}
