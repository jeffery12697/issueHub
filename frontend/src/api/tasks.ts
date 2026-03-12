import { apiClient } from './client'

export type Priority = 'none' | 'low' | 'medium' | 'high' | 'urgent'

export type Task = {
  id: string
  workspace_id: string
  project_id: string
  list_id: string | null
  parent_task_id: string | null
  status_id: string | null
  reporter_id: string
  reviewer_id: string | null
  title: string
  description: string | null
  priority: Priority
  assignee_ids: string[]
  due_date: string | null
  order_index: number
  depth: number
  subtask_count: number
}

export type CreateTaskData = {
  title: string
  description?: string
  priority?: Priority
  assignee_ids?: string[]
  reviewer_id?: string
  due_date?: string
  status_id?: string
}

export type UpdateTaskData = Partial<CreateTaskData>

export const tasksApi = {
  list: (listId: string, params?: { status_id?: string; priority?: Priority; assignee_id?: string }) =>
    apiClient.get<Task[]>(`/lists/${listId}/tasks`, { params }).then((r) => r.data),
  get: (id: string) => apiClient.get<Task>(`/tasks/${id}`).then((r) => r.data),
  create: (listId: string, data: CreateTaskData) =>
    apiClient.post<Task>(`/lists/${listId}/tasks`, data).then((r) => r.data),
  update: (id: string, data: UpdateTaskData) =>
    apiClient.patch<Task>(`/tasks/${id}`, data).then((r) => r.data),
  delete: (id: string) => apiClient.delete(`/tasks/${id}`),
  promote: (taskId: string) =>
    apiClient.post<Task>(`/tasks/${taskId}/promote`).then((r) => r.data),
  listSubtasks: (taskId: string) =>
    apiClient.get<Task[]>(`/tasks/${taskId}/subtasks`).then((r) => r.data),
  createSubtask: (taskId: string, data: CreateTaskData) =>
    apiClient.post<Task>(`/tasks/${taskId}/subtasks`, data).then((r) => r.data),
}
