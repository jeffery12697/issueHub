import { apiClient } from './client'

export type ListStatus = {
  id: string
  list_id: string
  name: string
  color: string
  order_index: number
  is_complete: boolean
  category: 'not_started' | 'active' | 'done' | 'cancelled'
}

export type List = {
  id: string
  project_id: string
  name: string
  description: string | null
  team_ids: string[]
  statuses?: ListStatus[]
}

export const listsApi = {
  list: (projectId: string) =>
    apiClient.get<List[]>(`/projects/${projectId}/lists`).then((r) => r.data),
  get: (id: string) => apiClient.get<List>(`/lists/${id}`).then((r) => r.data),
  create: (projectId: string, data: { name: string; description?: string }) =>
    apiClient.post<List>(`/projects/${projectId}/lists`, data).then((r) => r.data),
  update: (id: string, data: { name?: string; description?: string }) =>
    apiClient.patch<List>(`/lists/${id}`, data).then((r) => r.data),
  delete: (id: string) => apiClient.delete(`/lists/${id}`),
  setVisibility: (id: string, data: { team_ids: string[] }) =>
    apiClient.patch<List>(`/lists/${id}/visibility`, data).then((r) => r.data),

  // Statuses
  listStatuses: (listId: string) =>
    apiClient.get<ListStatus[]>(`/lists/${listId}/statuses`).then((r) => r.data),
  createStatus: (listId: string, data: { name: string; color?: string; category?: string }) =>
    apiClient.post<ListStatus>(`/lists/${listId}/statuses`, data).then((r) => r.data),
  updateStatus: (listId: string, statusId: string, data: Partial<ListStatus>) =>
    apiClient.patch<ListStatus>(`/lists/${listId}/statuses/${statusId}`, data).then((r) => r.data),
  deleteStatus: (listId: string, statusId: string) =>
    apiClient.delete(`/lists/${listId}/statuses/${statusId}`),
  reorderStatus: (listId: string, statusId: string, data: { before_id?: string; after_id?: string }) =>
    apiClient.post<ListStatus[]>(`/lists/${listId}/statuses/${statusId}/reorder`, data).then((r) => r.data),
}
