import { apiClient } from './client'

export type Workspace = {
  id: string
  name: string
}

export type Member = {
  user_id: string
  role: 'owner' | 'admin' | 'member' | 'guest'
}

export const workspacesApi = {
  list: () => apiClient.get<Workspace[]>('/workspaces').then((r) => r.data),
  get: (id: string) => apiClient.get<Workspace>(`/workspaces/${id}`).then((r) => r.data),
  create: (name: string) => apiClient.post<Workspace>('/workspaces', { name }).then((r) => r.data),
  update: (id: string, name: string) => apiClient.patch<Workspace>(`/workspaces/${id}`, { name }).then((r) => r.data),
  delete: (id: string) => apiClient.delete(`/workspaces/${id}`),
  listMembers: (id: string) => apiClient.get<Member[]>(`/workspaces/${id}/members`).then((r) => r.data),
}
