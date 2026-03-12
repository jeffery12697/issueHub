import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listsApi } from '@/api/lists'
import { tasksApi, type Task, type Priority } from '@/api/tasks'

const PRIORITY_COLORS: Record<Priority, string> = {
  none: 'text-gray-400',
  low: 'text-blue-400',
  medium: 'text-yellow-500',
  high: 'text-orange-500',
  urgent: 'text-red-500',
}

export default function ListPage() {
  const { projectId, listId } = useParams<{ projectId: string; listId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: list } = useQuery({
    queryKey: ['list', listId],
    queryFn: () => listsApi.get(listId!),
  })

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks', listId],
    queryFn: () => tasksApi.list(listId!),
  })

  const [newTitle, setNewTitle] = useState('')
  const [creating, setCreating] = useState(false)

  const createTask = useMutation({
    mutationFn: (title: string) => tasksApi.create(listId!, { title }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks', listId] })
      setCreating(false)
      setNewTitle('')
    },
  })

  const deleteTask = useMutation({
    mutationFn: tasksApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks', listId] }),
  })

  const statusMap = Object.fromEntries((list?.statuses ?? []).map((s) => [s.id, s]))

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-3">
        <Link to="/" className="text-gray-400 hover:text-gray-600 text-sm">Home</Link>
        <span className="text-gray-300">/</span>
        <span className="text-sm font-medium text-gray-800">{list?.name}</span>
        <div className="ml-auto flex gap-2">
          <Link
            to={`/projects/${projectId}/lists/${listId}/board`}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Board view
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto py-8 px-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">{list?.name}</h2>
          <button
            onClick={() => setCreating(true)}
            className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            + New task
          </button>
        </div>

        {creating && (
          <form
            className="mb-4 flex gap-2"
            onSubmit={(e) => { e.preventDefault(); createTask.mutate(newTitle) }}
          >
            <input
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Task title"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button type="submit" className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg">Create</button>
            <button type="button" onClick={() => setCreating(false)} className="text-sm px-3 py-2 text-gray-500">Cancel</button>
          </form>
        )}

        {isLoading ? (
          <p className="text-gray-400 text-sm">Loading...</p>
        ) : tasks.length === 0 ? (
          <p className="text-gray-400 text-sm">No tasks yet.</p>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Title</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Priority</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tasks.map((task: Task) => (
                  <tr key={task.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <button
                        onClick={() => navigate(`/tasks/${task.id}`)}
                        className="text-left text-gray-800 hover:text-blue-600 font-medium"
                      >
                        {task.title}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      {task.status_id && statusMap[task.status_id] ? (
                        <span
                          className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full"
                          style={{ backgroundColor: statusMap[task.status_id].color + '20', color: statusMap[task.status_id].color }}
                        >
                          {statusMap[task.status_id].name}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium capitalize ${PRIORITY_COLORS[task.priority]}`}>
                        {task.priority === 'none' ? '—' : task.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => deleteTask.mutate(task.id)}
                        className="text-gray-300 hover:text-red-400 text-xs"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}
