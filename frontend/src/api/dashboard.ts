import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from './client'

export type WidgetType = 'completion_rate' | 'overdue_count' | 'member_workload'

export type WidgetConfig = {
  project_id?: string | null
}

export type DashboardWidget = {
  id: string
  workspace_id: string
  widget_type: WidgetType
  config: WidgetConfig
  order_index: number
  visible_to_members: boolean
}

export type CompletionRateData = { total: number; done: number; rate: number }
export type OverdueCountData = { count: number }
export type MemberWorkloadData = { members: { user_id: string; display_name: string; open_task_count: number }[] }

export const dashboardApi = {
  list: (workspaceId: string) =>
    apiClient.get<DashboardWidget[]>(`/workspaces/${workspaceId}/dashboard`).then((r) => r.data),

  create: (workspaceId: string, data: { widget_type: WidgetType; config?: WidgetConfig; order_index?: number; visible_to_members?: boolean }) =>
    apiClient.post<DashboardWidget>(`/workspaces/${workspaceId}/dashboard/widgets`, data).then((r) => r.data),

  update: (workspaceId: string, widgetId: string, data: { config?: WidgetConfig; visible_to_members?: boolean; order_index?: number }) =>
    apiClient.patch<DashboardWidget>(`/workspaces/${workspaceId}/dashboard/widgets/${widgetId}`, data).then((r) => r.data),

  delete: (workspaceId: string, widgetId: string) =>
    apiClient.delete(`/workspaces/${workspaceId}/dashboard/widgets/${widgetId}`),

  reorder: (workspaceId: string, widgetIds: string[]) =>
    apiClient.put<DashboardWidget[]>(`/workspaces/${workspaceId}/dashboard/widgets/order`, { widget_ids: widgetIds }).then((r) => r.data),

  getData: (workspaceId: string, widgetId: string) =>
    apiClient.get(`/workspaces/${workspaceId}/dashboard/widgets/${widgetId}/data`).then((r) => r.data),
}

export function useDashboardWidgets(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['dashboard', workspaceId],
    queryFn: () => dashboardApi.list(workspaceId!),
    enabled: !!workspaceId,
  })
}

export function useWidgetData(workspaceId: string | undefined, widgetId: string | undefined) {
  return useQuery({
    queryKey: ['dashboard-data', widgetId],
    queryFn: () => dashboardApi.getData(workspaceId!, widgetId!),
    enabled: !!workspaceId && !!widgetId,
    refetchInterval: 60_000,
  })
}

export function useCreateWidget(workspaceId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { widget_type: WidgetType; config?: WidgetConfig; visible_to_members?: boolean }) =>
      dashboardApi.create(workspaceId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dashboard', workspaceId] }),
  })
}

export function useUpdateWidget(workspaceId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ widgetId, data }: { widgetId: string; data: { config?: WidgetConfig; visible_to_members?: boolean } }) =>
      dashboardApi.update(workspaceId, widgetId, data),
    onSuccess: (_, { widgetId }) => {
      qc.invalidateQueries({ queryKey: ['dashboard', workspaceId] })
      qc.invalidateQueries({ queryKey: ['dashboard-data', widgetId] })
    },
  })
}

export function useDeleteWidget(workspaceId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (widgetId: string) => dashboardApi.delete(workspaceId, widgetId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dashboard', workspaceId] }),
  })
}

export function useReorderWidgets(workspaceId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (widgetIds: string[]) => dashboardApi.reorder(workspaceId, widgetIds),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dashboard', workspaceId] }),
  })
}
