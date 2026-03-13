import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from './client'

export type TeamRole = 'team_admin' | 'team_member'

export type Team = {
  id: string
  workspace_id: string
  name: string
  created_by: string
}

export type TeamMember = {
  team_id: string
  user_id: string
  role: TeamRole
  display_name: string
}

export const teamsApi = {
  list: (workspaceId: string) =>
    apiClient.get<Team[]>(`/workspaces/${workspaceId}/teams`).then((r) => r.data),

  create: (workspaceId: string, data: { name: string }) =>
    apiClient.post<Team>(`/workspaces/${workspaceId}/teams`, data).then((r) => r.data),

  delete: (workspaceId: string, teamId: string) =>
    apiClient.delete(`/workspaces/${workspaceId}/teams/${teamId}`),

  listMembers: (workspaceId: string, teamId: string) =>
    apiClient
      .get<TeamMember[]>(`/workspaces/${workspaceId}/teams/${teamId}/members`)
      .then((r) => r.data),

  addMember: (workspaceId: string, teamId: string, data: { user_id: string; role: TeamRole }) =>
    apiClient
      .post<TeamMember>(`/workspaces/${workspaceId}/teams/${teamId}/members`, data)
      .then((r) => r.data),

  removeMember: (workspaceId: string, teamId: string, userId: string) =>
    apiClient.delete(`/workspaces/${workspaceId}/teams/${teamId}/members/${userId}`),
}

export function useTeams(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['teams', workspaceId],
    queryFn: () => teamsApi.list(workspaceId!),
    enabled: !!workspaceId,
  })
}

export function useTeamMembers(workspaceId: string | undefined, teamId: string | undefined) {
  return useQuery({
    queryKey: ['team-members', workspaceId, teamId],
    queryFn: () => teamsApi.listMembers(workspaceId!, teamId!),
    enabled: !!workspaceId && !!teamId,
  })
}

export function useCreateTeam(workspaceId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string }) => teamsApi.create(workspaceId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['teams', workspaceId] }),
  })
}

export function useDeleteTeam(workspaceId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (teamId: string) => teamsApi.delete(workspaceId, teamId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['teams', workspaceId] }),
  })
}

export function useAddTeamMember(workspaceId: string, teamId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { user_id: string; role: TeamRole }) =>
      teamsApi.addMember(workspaceId, teamId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team-members', workspaceId, teamId] }),
  })
}

export function useRemoveTeamMember(workspaceId: string, teamId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) => teamsApi.removeMember(workspaceId, teamId, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team-members', workspaceId, teamId] }),
  })
}
