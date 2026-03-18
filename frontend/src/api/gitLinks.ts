import { useQuery } from '@tanstack/react-query'
import { apiClient } from './client'

export interface TaskGitLink {
  id: string
  task_id: string
  platform: string   // "github" | "gitlab"
  repo: string
  pr_number: number | null
  pr_title: string | null
  pr_url: string | null
  branch: string
  status: string     // "open" | "merged"
  linked_at: string
  merged_at: string | null
}

export function useTaskGitLinks(taskId: string | undefined) {
  return useQuery<TaskGitLink[]>({
    queryKey: ['git-links', taskId],
    queryFn: () => apiClient.get(`/tasks/${taskId}/git-links`).then((r) => r.data),
    enabled: !!taskId,
  })
}
