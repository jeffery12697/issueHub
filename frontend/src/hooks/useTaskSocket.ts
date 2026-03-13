import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'

export function useTaskSocket(taskId: string | undefined) {
  const qc = useQueryClient()
  const { accessToken } = useAuthStore()

  useEffect(() => {
    if (!taskId || !accessToken) return

    const ws = new WebSocket(`ws://localhost:8000/ws/tasks/${taskId}`)

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        if (msg.event === 'task.updated') {
          qc.invalidateQueries({ queryKey: ['task', taskId] })
          qc.invalidateQueries({ queryKey: ['audit', taskId] })
        }
        if (msg.event === 'task.comment_added') {
          qc.invalidateQueries({ queryKey: ['comments', taskId] })
        }
      } catch {}
    }

    ws.onerror = () => ws.close()

    return () => ws.close()
  }, [taskId, accessToken, qc])
}

export function useListSocket(listId: string | undefined) {
  const qc = useQueryClient()
  const { accessToken } = useAuthStore()

  useEffect(() => {
    if (!listId || !accessToken) return

    const ws = new WebSocket(`ws://localhost:8000/ws/lists/${listId}`)

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        if (msg.event === 'task.updated') {
          qc.invalidateQueries({ queryKey: ['tasks', listId] })
        }
      } catch {}
    }

    ws.onerror = () => ws.close()

    return () => ws.close()
  }, [listId, accessToken, qc])
}
