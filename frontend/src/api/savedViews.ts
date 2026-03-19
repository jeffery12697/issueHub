import { apiClient } from './client'
import type { FilterRule } from '@/components/FilterBar'

export interface SavedViewFilters {
  filter_rules: FilterRule[]
  cf_filters: Record<string, string>
  group_by: string
}

export interface SavedView {
  id: string
  name: string
  filters_json: SavedViewFilters
  is_default: boolean
  created_at: string
}

export const savedViewsApi = {
  listForList: (listId: string) =>
    apiClient.get<SavedView[]>(`/lists/${listId}/saved-views`).then((r: { data: SavedView[] }) => r.data),

  listForProject: (projectId: string) =>
    apiClient.get<SavedView[]>(`/projects/${projectId}/saved-views`).then((r: { data: SavedView[] }) => r.data),

  createForList: (listId: string, name: string, filters: SavedViewFilters) =>
    apiClient
      .post<SavedView>(`/lists/${listId}/saved-views`, { name, filters_json: filters })
      .then((r: { data: SavedView }) => r.data),

  createForProject: (projectId: string, name: string, filters: SavedViewFilters) =>
    apiClient
      .post<SavedView>(`/projects/${projectId}/saved-views`, { name, filters_json: filters })
      .then((r: { data: SavedView }) => r.data),

  delete: (id: string) => apiClient.delete(`/saved-views/${id}`),

  setDefault: (id: string) =>
    apiClient.patch<SavedView>(`/saved-views/${id}/set-default`).then((r: { data: SavedView }) => r.data),
}
