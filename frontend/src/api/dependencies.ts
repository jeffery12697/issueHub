import { apiClient } from './client'
import type { Task } from './tasks'

export const dependenciesApi = {
  getBlockedBy: (taskId: string) =>
    apiClient.get<Task[]>(`/tasks/${taskId}/blocked-by`).then((r) => r.data),
  getBlocking: (taskId: string) =>
    apiClient.get<Task[]>(`/tasks/${taskId}/blocking`).then((r) => r.data),
  addBlockedBy: (taskId: string, dependsOnId: string) =>
    apiClient.post(`/tasks/${taskId}/blocked-by`, { depends_on_id: dependsOnId }),
  removeBlockedBy: (taskId: string, dependsOnId: string) =>
    apiClient.delete(`/tasks/${taskId}/blocked-by/${dependsOnId}`),
}
