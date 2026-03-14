import { apiClient } from './client'
import { useQuery } from '@tanstack/react-query'

export type Project = {
  id: string
  workspace_id: string
  name: string
  description: string | null
  task_prefix: string
}

export const projectsApi = {
  list: (workspaceId: string) =>
    apiClient.get<Project[]>(`/workspaces/${workspaceId}/projects`).then((r) => r.data),
  get: (id: string) => apiClient.get<Project>(`/projects/${id}`).then((r) => r.data),
  create: (workspaceId: string, data: { name: string; description?: string; task_prefix?: string }) =>
    apiClient.post<Project>(`/workspaces/${workspaceId}/projects`, data).then((r) => r.data),
  update: (id: string, data: { name?: string; description?: string; task_prefix?: string }) =>
    apiClient.patch<Project>(`/projects/${id}`, data).then((r) => r.data),
  delete: (id: string) => apiClient.delete(`/projects/${id}`),
  analytics: (projectId: string) =>
    apiClient.get<ProjectAnalytics>(`/projects/${projectId}/analytics`).then((r) => r.data),
}

export type StatusCount = {
  status_id: string | null
  status_name: string | null
  count: number
  story_points: number
}

export type ProjectAnalytics = {
  total_tasks: number
  overdue_tasks: number
  total_story_points: number
  tasks_by_status: StatusCount[]
}

export function useProjectAnalytics(projectId: string | undefined) {
  return useQuery({
    queryKey: ['project-analytics', projectId],
    queryFn: () => projectsApi.analytics(projectId!),
    enabled: !!projectId,
  })
}
