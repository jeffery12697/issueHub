import { apiClient } from './client'

export type Project = {
  id: string
  workspace_id: string
  name: string
  description: string | null
}

export const projectsApi = {
  list: (workspaceId: string) =>
    apiClient.get<Project[]>(`/workspaces/${workspaceId}/projects`).then((r) => r.data),
  get: (id: string) => apiClient.get<Project>(`/projects/${id}`).then((r) => r.data),
  create: (workspaceId: string, data: { name: string; description?: string }) =>
    apiClient.post<Project>(`/workspaces/${workspaceId}/projects`, data).then((r) => r.data),
  update: (id: string, data: { name?: string; description?: string }) =>
    apiClient.patch<Project>(`/projects/${id}`, data).then((r) => r.data),
  delete: (id: string) => apiClient.delete(`/projects/${id}`),
}
