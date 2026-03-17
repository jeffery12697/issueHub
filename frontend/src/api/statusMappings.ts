import { apiClient } from './client'

export type StatusMapping = {
  id: string
  project_id: string
  from_list_id: string
  from_status_id: string
  to_list_id: string
  to_status_id: string
}

export const statusMappingsApi = {
  list: (projectId: string) =>
    apiClient.get<StatusMapping[]>(`/projects/${projectId}/status-mappings`).then((r) => r.data),
  upsert: (projectId: string, data: Omit<StatusMapping, 'id' | 'project_id'>) =>
    apiClient.put<StatusMapping>(`/projects/${projectId}/status-mappings`, data).then((r) => r.data),
  delete: (projectId: string, mappingId: string) =>
    apiClient.delete(`/projects/${projectId}/status-mappings/${mappingId}`),
}
