import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from './client'

export type TemplateStatus = {
  name: string
  color: string
  is_complete: boolean
  category: string
  order_index: number
}

export type ListTemplate = {
  id: string
  workspace_id: string
  name: string
  default_statuses: TemplateStatus[]
}

export const listTemplatesApi = {
  list: (workspaceId: string) =>
    apiClient.get<ListTemplate[]>(`/workspaces/${workspaceId}/list-templates`).then(r => r.data),
  create: (workspaceId: string, data: { name: string; default_statuses: TemplateStatus[] }) =>
    apiClient.post<ListTemplate>(`/workspaces/${workspaceId}/list-templates`, data).then(r => r.data),
  delete: (workspaceId: string, templateId: string) =>
    apiClient.delete(`/workspaces/${workspaceId}/list-templates/${templateId}`),
  createListFromTemplate: (projectId: string, data: { name: string; template_id: string }) =>
    apiClient.post(`/projects/${projectId}/lists/from-template`, data).then(r => r.data),
}

export function useListTemplates(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['list-templates', workspaceId],
    queryFn: () => listTemplatesApi.list(workspaceId!),
    enabled: !!workspaceId,
  })
}

export function useCreateTemplate(workspaceId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; default_statuses: TemplateStatus[] }) =>
      listTemplatesApi.create(workspaceId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['list-templates', workspaceId] }),
  })
}

export function useDeleteTemplate(workspaceId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (templateId: string) => listTemplatesApi.delete(workspaceId, templateId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['list-templates', workspaceId] }),
  })
}
