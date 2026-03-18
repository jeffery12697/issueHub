import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from './client'

export type DescriptionTemplate = {
  id: string
  workspace_id: string
  name: string
  content: string
}

export const descriptionTemplatesApi = {
  list: (workspaceId: string) =>
    apiClient.get<DescriptionTemplate[]>(`/workspaces/${workspaceId}/description-templates`).then(r => r.data),
  create: (workspaceId: string, data: { name: string; content: string }) =>
    apiClient.post<DescriptionTemplate>(`/workspaces/${workspaceId}/description-templates`, data).then(r => r.data),
  update: (workspaceId: string, templateId: string, data: { name?: string; content?: string }) =>
    apiClient.patch<DescriptionTemplate>(`/workspaces/${workspaceId}/description-templates/${templateId}`, data).then(r => r.data),
  delete: (workspaceId: string, templateId: string) =>
    apiClient.delete(`/workspaces/${workspaceId}/description-templates/${templateId}`),
}

export function useDescriptionTemplates(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['description-templates', workspaceId],
    queryFn: () => descriptionTemplatesApi.list(workspaceId!),
    enabled: !!workspaceId,
  })
}

export function useCreateDescriptionTemplate(workspaceId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; content: string }) =>
      descriptionTemplatesApi.create(workspaceId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['description-templates', workspaceId] }),
  })
}

export function useUpdateDescriptionTemplate(workspaceId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ templateId, data }: { templateId: string; data: { name?: string; content?: string } }) =>
      descriptionTemplatesApi.update(workspaceId, templateId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['description-templates', workspaceId] }),
  })
}

export function useDeleteDescriptionTemplate(workspaceId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (templateId: string) => descriptionTemplatesApi.delete(workspaceId, templateId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['description-templates', workspaceId] }),
  })
}
