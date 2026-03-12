import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from './client'

export type Comment = {
  id: string
  task_id: string
  author_id: string
  body: string
  parent_comment_id: string | null
  mentions: string[]
  created_at: string
  updated_at: string
}

export const commentsApi = {
  list: (taskId: string) =>
    apiClient.get<Comment[]>(`/tasks/${taskId}/comments`).then((r) => r.data),

  create: (taskId: string, body: string, parent_comment_id?: string | null) =>
    apiClient
      .post<Comment>(`/tasks/${taskId}/comments`, { body, parent_comment_id: parent_comment_id ?? null })
      .then((r) => r.data),

  delete: (taskId: string, commentId: string) =>
    apiClient.delete(`/tasks/${taskId}/comments/${commentId}`),
}

export function useComments(taskId: string) {
  return useQuery({
    queryKey: ['comments', taskId],
    queryFn: () => commentsApi.list(taskId),
    enabled: !!taskId,
  })
}

export function useCreateComment(taskId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ body, parent_comment_id }: { body: string; parent_comment_id?: string | null }) =>
      commentsApi.create(taskId, body, parent_comment_id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['comments', taskId] })
      qc.invalidateQueries({ queryKey: ['audit', taskId] })
    },
  })
}

export function useDeleteComment(taskId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (commentId: string) => commentsApi.delete(taskId, commentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comments', taskId] }),
  })
}
