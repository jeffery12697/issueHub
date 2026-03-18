import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from './client'

export type EpicStatus = 'not_started' | 'in_progress' | 'done'

export type Epic = {
  id: string
  project_id: string
  workspace_id: string
  name: string
  description: string | null
  color: string | null
  status: EpicStatus
  start_date: string | null
  due_date: string | null
  order_index: number
  created_by: string
  task_count: number
  done_count: number
}

export type CreateEpicData = {
  name: string
  description?: string
  color?: string
  status?: EpicStatus
  start_date?: string
  due_date?: string
}

export type UpdateEpicData = Partial<CreateEpicData>

export const epicsApi = {
  list: (projectId: string) =>
    apiClient.get<Epic[]>(`/projects/${projectId}/epics`).then((r) => r.data),
  get: (epicId: string) =>
    apiClient.get<Epic>(`/epics/${epicId}`).then((r) => r.data),
  create: (projectId: string, data: CreateEpicData) =>
    apiClient.post<Epic>(`/projects/${projectId}/epics`, data).then((r) => r.data),
  update: (epicId: string, data: UpdateEpicData) =>
    apiClient.patch<Epic>(`/epics/${epicId}`, data).then((r) => r.data),
  delete: (epicId: string) =>
    apiClient.delete(`/epics/${epicId}`),
}

export function useEpics(projectId: string | undefined) {
  return useQuery({
    queryKey: ['epics', projectId],
    queryFn: () => epicsApi.list(projectId!),
    enabled: !!projectId,
  })
}

export function useCreateEpic(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateEpicData) => epicsApi.create(projectId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['epics', projectId] }),
  })
}

export function useUpdateEpic(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ epicId, data }: { epicId: string; data: UpdateEpicData }) =>
      epicsApi.update(epicId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['epics', projectId] }),
  })
}

export function useDeleteEpic(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (epicId: string) => epicsApi.delete(epicId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['epics', projectId] }),
  })
}
