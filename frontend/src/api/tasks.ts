import { useQuery } from '@tanstack/react-query'
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
  start_date: string | null
  story_points: number | null
  order_index: number
  depth: number
  subtask_count: number
  task_number: number | null
  task_key: string | null
}

export type TaskSearchResult = Task & {
  list_name: string | null
  project_name: string | null
}

export type CreateTaskData = {
  title: string
  description?: string
  priority?: Priority
  assignee_ids?: string[]
  reviewer_id?: string
  due_date?: string
  start_date?: string
  story_points?: number | null
  status_id?: string
  list_id?: string
}

export type UpdateTaskData = Partial<Omit<CreateTaskData, 'reviewer_id'>> & {
  reviewer_id?: string | null
}

export const tasksApi = {
  list: (listId: string, params?: { status_id?: string; priority?: Priority; assignee_id?: string; cf?: Record<string, string>; include_subtasks?: boolean }) => {
    const p: Record<string, string> = {}
    if (params?.status_id) p.status_id = params.status_id
    if (params?.priority) p.priority = params.priority
    if (params?.assignee_id) p.assignee_id = params.assignee_id
    if (params?.include_subtasks) p.include_subtasks = 'true'
    if (params?.cf) {
      for (const [fieldId, value] of Object.entries(params.cf)) {
        if (value) p[`cf[${fieldId}]`] = value
      }
    }
    return apiClient.get<Task[]>(`/lists/${listId}/tasks`, { params: p }).then((r) => r.data)
  },
  listPaged: (listId: string, params: { page: number; page_size: number; status_id?: string; status_id_not?: string; priority?: Priority; priority_not?: string; cf?: Record<string, string>; include_subtasks?: boolean }) => {
    const p: Record<string, string> = { page: String(params.page), page_size: String(params.page_size) }
    if (params.status_id) p.status_id = params.status_id
    if (params.status_id_not) p.status_id_not = params.status_id_not
    if (params.priority) p.priority = params.priority
    if (params.priority_not) p.priority_not = params.priority_not
    if (params.include_subtasks) p.include_subtasks = 'true'
    if (params.cf) {
      for (const [fieldId, value] of Object.entries(params.cf)) {
        if (value) p[`cf[${fieldId}]`] = value
      }
    }
    return apiClient.get<Task[]>(`/lists/${listId}/tasks`, { params: p }).then((r) => ({
      items: r.data,
      total: parseInt(r.headers['x-total-count'] ?? '0', 10),
    }))
  },
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
  myTasks: (workspaceId: string, params?: { status_id?: string; priority?: Priority }) =>
    apiClient.get<Task[]>(`/workspaces/${workspaceId}/me/tasks`, { params }).then((r) => r.data),
  exportCsv: async (listId: string): Promise<void> => {
    const r = await apiClient.get(`/lists/${listId}/tasks/export`, { responseType: 'blob' })
    const url = URL.createObjectURL(r.data as Blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'tasks.csv'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  },
  search: (workspaceId: string, q: string) =>
    apiClient.get<TaskSearchResult[]>(`/workspaces/${workspaceId}/search`, { params: { q } }).then((r) => r.data),
  bulkUpdate: (taskIds: string[], data: { status_id?: string; priority?: string }) =>
    apiClient.post<{ updated: number }>('/tasks/bulk-update', { task_ids: taskIds, ...data }).then((r) => r.data),
  bulkDelete: (taskIds: string[]) =>
    apiClient.post<{ updated: number }>('/tasks/bulk-delete', { task_ids: taskIds }).then((r) => r.data),
  move: (taskId: string, listId: string) =>
    apiClient.patch<Task>(`/tasks/${taskId}/move`, { list_id: listId }).then((r) => r.data),
  listForProject: (projectId: string, params: { page: number; page_size: number; list_id?: string; priority?: Priority; priority_not?: string; assignee_id?: string; include_subtasks?: boolean }) => {
    const p: Record<string, string> = { page: String(params.page), page_size: String(params.page_size) }
    if (params.list_id) p.list_id = params.list_id
    if (params.priority) p.priority = params.priority
    if (params.priority_not) p.priority_not = params.priority_not
    if (params.assignee_id) p.assignee_id = params.assignee_id
    if (params.include_subtasks) p.include_subtasks = 'true'
    return apiClient.get<Task[]>(`/projects/${projectId}/tasks`, { params: p }).then((r) => ({
      items: r.data,
      total: parseInt(r.headers['x-total-count'] ?? '0', 10),
    }))
  },
}

export function useMyTasks(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['my-tasks', workspaceId],
    queryFn: () => tasksApi.myTasks(workspaceId!),
    enabled: !!workspaceId,
  })
}
