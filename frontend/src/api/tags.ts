import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from './client'

export type Tag = {
  id: string
  workspace_id: string
  name: string
  color: string
}

const tagsApi = {
  list: (workspaceId: string) =>
    apiClient.get<Tag[]>(`/workspaces/${workspaceId}/tags`).then((r) => r.data),
  create: (workspaceId: string, data: { name: string; color: string }) =>
    apiClient.post<Tag>(`/workspaces/${workspaceId}/tags`, data).then((r) => r.data),
  update: (workspaceId: string, tagId: string, data: { name?: string; color?: string }) =>
    apiClient.patch<Tag>(`/workspaces/${workspaceId}/tags/${tagId}`, data).then((r) => r.data),
  delete: (workspaceId: string, tagId: string) =>
    apiClient.delete(`/workspaces/${workspaceId}/tags/${tagId}`),
  listForTask: (taskId: string) =>
    apiClient.get<Tag[]>(`/tasks/${taskId}/tags`).then((r) => r.data),
  addToTask: (taskId: string, tagId: string) =>
    apiClient.post<Tag>(`/tasks/${taskId}/tags`, { tag_id: tagId }).then((r) => r.data),
  removeFromTask: (taskId: string, tagId: string) =>
    apiClient.delete(`/tasks/${taskId}/tags/${tagId}`),
}

export function useWorkspaceTags(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['workspace-tags', workspaceId],
    queryFn: () => tagsApi.list(workspaceId!),
    enabled: !!workspaceId,
  })
}

export function useCreateTag(workspaceId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; color: string }) => tagsApi.create(workspaceId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workspace-tags', workspaceId] }),
  })
}

export function useUpdateTag(workspaceId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; color?: string }) =>
      tagsApi.update(workspaceId, id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workspace-tags', workspaceId] }),
  })
}

export function useDeleteTag(workspaceId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (tagId: string) => tagsApi.delete(workspaceId, tagId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workspace-tags', workspaceId] }),
  })
}

export function useTaskTags(taskId: string | undefined) {
  return useQuery({
    queryKey: ['task-tags', taskId],
    queryFn: () => tagsApi.listForTask(taskId!),
    enabled: !!taskId,
  })
}

export function useAddTagToTask(taskId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (tagId: string) => tagsApi.addToTask(taskId, tagId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task-tags', taskId] })
      qc.invalidateQueries({ queryKey: ['task', taskId] })
    },
  })
}

export function useRemoveTagFromTask(taskId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (tagId: string) => tagsApi.removeFromTask(taskId, tagId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task-tags', taskId] })
      qc.invalidateQueries({ queryKey: ['task', taskId] })
    },
  })
}
