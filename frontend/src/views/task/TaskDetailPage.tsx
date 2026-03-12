import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { tasksApi, type Priority } from '@/api/tasks'
import { listsApi } from '@/api/lists'

const PRIORITIES: Priority[] = ['none', 'low', 'medium', 'high', 'urgent']

export default function TaskDetailPage() {
  const { taskId } = useParams<{ taskId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: task, isLoading } = useQuery({
    queryKey: ['task', taskId],
    queryFn: () => tasksApi.get(taskId!),
  })

  const { data: list } = useQuery({
    queryKey: ['list', task?.list_id],
    queryFn: () => listsApi.get(task!.list_id!),
    enabled: !!task?.list_id,
  })

  const [editingTitle, setEditingTitle] = useState(false)
  const [title, setTitle] = useState('')

  const updateTask = useMutation({
    mutationFn: (data: Parameters<typeof tasksApi.update>[1]) =>
      tasksApi.update(taskId!, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['task', taskId] }),
  })

  const deleteTask = useMutation({
    mutationFn: () => tasksApi.delete(taskId!),
    onSuccess: () => navigate(-1),
  })

  if (isLoading) return <div className="flex items-center justify-center h-screen text-gray-400">Loading...</div>
  if (!task) return <div className="flex items-center justify-center h-screen text-gray-400">Task not found</div>

  const statuses = list?.statuses ?? []

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600 text-sm">← Back</button>
        <span className="text-gray-300">/</span>
        <span className="text-sm text-gray-500">Task detail</span>
      </header>

      <main className="max-w-2xl mx-auto py-10 px-6">
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">

          {/* Title */}
          <div>
            {editingTitle ? (
              <form onSubmit={(e) => {
                e.preventDefault()
                updateTask.mutate({ title })
                setEditingTitle(false)
              }}>
                <input
                  autoFocus
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full text-xl font-semibold border-b border-blue-400 outline-none pb-1"
                />
              </form>
            ) : (
              <h1
                className="text-xl font-semibold text-gray-900 cursor-pointer hover:text-blue-600"
                onClick={() => { setTitle(task.title); setEditingTitle(true) }}
              >
                {task.title}
              </h1>
            )}
          </div>

          {/* Status */}
          {statuses.length > 0 && (
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Status</label>
              <div className="flex flex-wrap gap-2 mt-2">
                {statuses.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => updateTask.mutate({ status_id: s.id })}
                    className="text-xs px-3 py-1 rounded-full border transition-colors"
                    style={
                      task.status_id === s.id
                        ? { backgroundColor: s.color, color: '#fff', borderColor: s.color }
                        : { borderColor: s.color, color: s.color }
                    }
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Priority */}
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Priority</label>
            <div className="flex gap-2 mt-2">
              {PRIORITIES.map((p) => (
                <button
                  key={p}
                  onClick={() => updateTask.mutate({ priority: p })}
                  className={`text-xs px-3 py-1 rounded-full border capitalize transition-colors ${
                    task.priority === p
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'border-gray-300 text-gray-500 hover:border-gray-400'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Description</label>
            <textarea
              defaultValue={task.description ?? ''}
              onBlur={(e) => updateTask.mutate({ description: e.target.value })}
              placeholder="Add a description..."
              rows={4}
              className="mt-2 w-full text-sm text-gray-700 border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Delete */}
          <div className="pt-2 border-t border-gray-100">
            <button
              onClick={() => deleteTask.mutate()}
              className="text-sm text-red-400 hover:text-red-600"
            >
              Delete task
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
