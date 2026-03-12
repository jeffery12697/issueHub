import { apiClient } from './client'

export type AuditLog = {
  id: string
  task_id: string
  actor_id: string
  action: string
  changes: Record<string, [string | null, string]> | null
  created_at: string
}

export const auditApi = {
  listForTask: (taskId: string) =>
    apiClient.get<AuditLog[]>(`/tasks/${taskId}/audit`).then((r) => r.data),
}
