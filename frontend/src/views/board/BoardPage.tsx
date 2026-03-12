import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listsApi, type ListStatus } from '@/api/lists'
import { tasksApi, type Task } from '@/api/tasks'
import { useState } from 'react'

export default function BoardPage() {
  const { projectId, listId } = useParams<{ projectId: string; listId: string }>()
  const qc = useQueryClient()

  const { data: list } = useQuery({
    queryKey: ['list', listId],
    queryFn: () => listsApi.get(listId!),
  })

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks', listId],
    queryFn: () => tasksApi.list(listId!),
  })

  const updateTask = useMutation({
    mutationFn: ({ id, status_id }: { id: string; status_id: string }) =>
      tasksApi.update(id, { status_id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks', listId] }),
  })

  const statuses = list?.statuses ?? []

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-3">
        <Link to="/" className="text-gray-400 hover:text-gray-600 text-sm">Home</Link>
        <span className="text-gray-300">/</span>
        <span className="text-sm font-medium text-gray-800">{list?.name}</span>
        <div className="ml-auto">
          <Link
            to={`/projects/${projectId}/lists/${listId}`}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            List view
          </Link>
        </div>
      </header>

      <main className="p-6 overflow-x-auto">
        <div className="flex gap-4 min-w-max">
          {statuses.length === 0 ? (
            <p className="text-gray-400 text-sm">No statuses configured. Add statuses in list settings.</p>
          ) : (
            statuses.map((status: ListStatus) => (
              <KanbanColumn
                key={status.id}
                status={status}
                tasks={tasks.filter((t: Task) => t.status_id === status.id)}
                onMoveTask={(taskId) => updateTask.mutate({ id: taskId, status_id: status.id })}
              />
            ))
          )}
        </div>
      </main>
    </div>
  )
}

function KanbanColumn({
  status,
  tasks,
  onMoveTask,
}: {
  status: ListStatus
  tasks: Task[]
  onMoveTask: (taskId: string) => void
}) {
  const [isDragOver, setIsDragOver] = useState(false)

  return (
    <div
      className={`w-72 rounded-xl flex flex-col ${isDragOver ? 'ring-2 ring-blue-400' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setIsDragOver(false)
        const taskId = e.dataTransfer.getData('taskId')
        if (taskId) onMoveTask(taskId)
      }}
    >
      <div className="flex items-center gap-2 px-3 py-2 mb-2">
        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: status.color }} />
        <span className="text-sm font-medium text-gray-700">{status.name}</span>
        <span className="ml-auto text-xs text-gray-400">{tasks.length}</span>
      </div>

      <div className="space-y-2 min-h-16">
        {tasks.map((task) => (
          <div
            key={task.id}
            draggable
            onDragStart={(e) => e.dataTransfer.setData('taskId', task.id)}
            className="bg-white border border-gray-200 rounded-lg px-3 py-2.5 cursor-grab shadow-sm hover:shadow-md transition-shadow"
          >
            <p className="text-sm text-gray-800 font-medium">{task.title}</p>
            {task.priority !== 'none' && (
              <p className="text-xs text-gray-400 mt-1 capitalize">{task.priority}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
