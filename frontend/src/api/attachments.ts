import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from './client'

export type Attachment = {
  id: string
  task_id: string
  comment_id: string | null
  uploaded_by: string
  filename: string
  size: number
  mime_type: string
  created_at: string
  url: string
}

export const attachmentsApi = {
  list: (taskId: string, commentId?: string | null) => {
    const params = commentId ? { comment_id: commentId } : {}
    return apiClient
      .get<Attachment[]>(`/tasks/${taskId}/attachments`, { params })
      .then((r) => r.data)
  },

  upload: (taskId: string, file: File, commentId?: string | null) => {
    const form = new FormData()
    form.append('file', file)
    const params = commentId ? { comment_id: commentId } : {}
    return apiClient
      .post<Attachment>(`/tasks/${taskId}/attachments`, form, { params })
      .then((r) => r.data)
  },

  delete: (attachmentId: string) =>
    apiClient.delete(`/attachments/${attachmentId}`),
}

export function useAttachments(taskId: string | undefined, commentId?: string | null) {
  return useQuery({
    queryKey: ['attachments', taskId, commentId ?? null],
    queryFn: () => attachmentsApi.list(taskId!, commentId),
    enabled: !!taskId,
  })
}

export function useUploadAttachment(taskId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ file, commentId }: { file: File; commentId?: string | null }) =>
      attachmentsApi.upload(taskId, file, commentId),
    onSuccess: (_att, { commentId }) => {
      qc.invalidateQueries({ queryKey: ['attachments', taskId, commentId ?? null] })
      qc.invalidateQueries({ queryKey: ['audit', taskId] })
    },
  })
}

export function useDeleteAttachment(taskId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ attachmentId, commentId }: { attachmentId: string; commentId?: string | null }) =>
      attachmentsApi.delete(attachmentId),
    onSuccess: (_r, { commentId }) => {
      qc.invalidateQueries({ queryKey: ['attachments', taskId, commentId ?? null] })
      qc.invalidateQueries({ queryKey: ['audit', taskId] })
    },
  })
}
