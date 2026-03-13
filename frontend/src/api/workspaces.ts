import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from './client'
import type { Task } from './tasks'

export type Workspace = {
  id: string
  name: string
}

export type Member = {
  user_id: string
  display_name: string
  role: 'owner' | 'admin' | 'member' | 'guest'
}

export type StatusCount = {
  status_id: string | null
  status_name: string | null
  count: number
}

export type AnalyticsResponse = {
  total_tasks: number
  overdue_tasks: number
  tasks_by_status: StatusCount[]
}

export type MemberWorkloadResponse = {
  user_id: string
  display_name: string
  open_task_count: number
  tasks: Task[]
}

export type UserSearchResult = {
  id: string
  email: string
  display_name: string
}

export const workspacesApi = {
  list: () => apiClient.get<Workspace[]>('/workspaces').then((r) => r.data),
  get: (id: string) => apiClient.get<Workspace>(`/workspaces/${id}`).then((r) => r.data),
  create: (name: string) => apiClient.post<Workspace>('/workspaces', { name }).then((r) => r.data),
  update: (id: string, name: string) => apiClient.patch<Workspace>(`/workspaces/${id}`, { name }).then((r) => r.data),
  delete: (id: string) => apiClient.delete(`/workspaces/${id}`),
  listMembers: (id: string) => apiClient.get<Member[]>(`/workspaces/${id}/members`).then((r) => r.data),
  inviteMember: (id: string, user_id: string, role: string) =>
    apiClient.post<Member>(`/workspaces/${id}/members`, { user_id, role }).then((r) => r.data),
  updateMemberRole: (id: string, userId: string, role: string) =>
    apiClient.patch<Member>(`/workspaces/${id}/members/${userId}`, { role }).then((r) => r.data),
  removeMember: (id: string, userId: string) =>
    apiClient.delete(`/workspaces/${id}/members/${userId}`),
  searchUser: (email: string) =>
    apiClient.get<UserSearchResult | null>('/auth/users/search', { params: { email } }).then((r) => r.data),
  getAnalytics: (workspaceId: string) =>
    apiClient.get<AnalyticsResponse>(`/workspaces/${workspaceId}/analytics`).then((r) => r.data),
  getWorkload: (workspaceId: string) =>
    apiClient.get<MemberWorkloadResponse[]>(`/workspaces/${workspaceId}/workload`).then((r) => r.data),
}

export function useWorkspaceMembers(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['workspace-members', workspaceId],
    queryFn: () => workspacesApi.listMembers(workspaceId!),
    enabled: !!workspaceId,
  })
}

export function useInviteMember(workspaceId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ user_id, role }: { user_id: string; role: string }) =>
      workspacesApi.inviteMember(workspaceId, user_id, role),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workspace-members', workspaceId] }),
  })
}

export function useUpdateMemberRole(workspaceId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      workspacesApi.updateMemberRole(workspaceId, userId, role),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workspace-members', workspaceId] }),
  })
}

export function useRemoveMember(workspaceId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) => workspacesApi.removeMember(workspaceId, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workspace-members', workspaceId] }),
  })
}

export function useAnalytics(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['analytics', workspaceId],
    queryFn: () => workspacesApi.getAnalytics(workspaceId!),
    enabled: !!workspaceId,
  })
}

export function useWorkload(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['workload', workspaceId],
    queryFn: () => workspacesApi.getWorkload(workspaceId!),
    enabled: !!workspaceId,
  })
}
