import { apiClient } from './client'

export type TriggerType = 'status_changed' | 'priority_changed'
export type ActionType = 'set_status' | 'set_priority' | 'assign_reviewer' | 'clear_assignees'

export type Automation = {
  id: string
  list_id: string
  trigger_type: TriggerType
  trigger_value: string
  action_type: ActionType
  action_value: string | null
  created_by: string
  created_at: string
}

export type CreateAutomationBody = {
  trigger_type: TriggerType
  trigger_value: string
  action_type: ActionType
  action_value?: string | null
}

export const automationsApi = {
  list: (listId: string) =>
    apiClient.get<Automation[]>(`/lists/${listId}/automations`).then((r) => r.data),

  create: (listId: string, body: CreateAutomationBody) =>
    apiClient.post<Automation>(`/lists/${listId}/automations`, body).then((r) => r.data),

  delete: (automationId: string) =>
    apiClient.delete(`/automations/${automationId}`),
}
