import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { workspacesApi } from '@/api/workspaces'
import { projectsApi, type Project } from '@/api/projects'
import { listsApi, type List } from '@/api/lists'

export default function ProjectPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const qc = useQueryClient()

  const { data: workspace } = useQuery({
    queryKey: ['workspace', workspaceId],
    queryFn: () => workspacesApi.get(workspaceId!),
  })

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects', workspaceId],
    queryFn: () => projectsApi.list(workspaceId!),
  })

  const [newProjectName, setNewProjectName] = useState('')
  const [creatingProject, setCreatingProject] = useState(false)

  const createProject = useMutation({
    mutationFn: (name: string) => projectsApi.create(workspaceId!, { name }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects', workspaceId] })
      setCreatingProject(false)
      setNewProjectName('')
    },
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-3">
        <Link to="/" className="text-gray-400 hover:text-gray-600 text-sm">Workspaces</Link>
        <span className="text-gray-300">/</span>
        <span className="text-sm font-medium text-gray-800">{workspace?.name}</span>
      </header>

      <main className="max-w-3xl mx-auto py-10 px-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Projects</h2>
          <button
            onClick={() => setCreatingProject(true)}
            className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            New project
          </button>
        </div>

        {creatingProject && (
          <form
            className="mb-4 flex gap-2"
            onSubmit={(e) => { e.preventDefault(); createProject.mutate(newProjectName) }}
          >
            <input
              autoFocus
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="Project name"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button type="submit" className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg">Create</button>
            <button type="button" onClick={() => setCreatingProject(false)} className="text-sm px-3 py-2 text-gray-500">Cancel</button>
          </form>
        )}

        {isLoading ? (
          <p className="text-gray-400 text-sm">Loading...</p>
        ) : (
          <div className="space-y-4">
            {projects.map((project: Project) => (
              <ProjectCard key={project.id} project={project} workspaceId={workspaceId!} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

function ProjectCard({ project, workspaceId }: { project: Project; workspaceId: string }) {
  const qc = useQueryClient()
  const [newListName, setNewListName] = useState('')
  const [creatingList, setCreatingList] = useState(false)

  const { data: lists = [] } = useQuery({
    queryKey: ['lists', project.id],
    queryFn: () => listsApi.list(project.id),
  })

  const createList = useMutation({
    mutationFn: (name: string) => listsApi.create(project.id, { name }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lists', project.id] })
      setCreatingList(false)
      setNewListName('')
    },
  })

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900">{project.name}</h3>
        <button
          onClick={() => setCreatingList(true)}
          className="text-xs text-blue-600 hover:text-blue-700 font-medium"
        >
          + New list
        </button>
      </div>

      {creatingList && (
        <form
          className="mb-3 flex gap-2"
          onSubmit={(e) => { e.preventDefault(); createList.mutate(newListName) }}
        >
          <input
            autoFocus
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
            placeholder="List name"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button type="submit" className="bg-blue-600 text-white text-xs px-3 py-1.5 rounded-lg">Create</button>
          <button type="button" onClick={() => setCreatingList(false)} className="text-xs px-2 text-gray-500">Cancel</button>
        </form>
      )}

      {lists.length === 0 ? (
        <p className="text-gray-400 text-xs">No lists yet.</p>
      ) : (
        <ul className="space-y-1">
          {lists.map((list: List) => (
            <li key={list.id} className="flex items-center gap-2">
              <Link
                to={`/projects/${project.id}/lists/${list.id}`}
                className="text-sm text-gray-700 hover:text-blue-600"
              >
                {list.name}
              </Link>
              <Link
                to={`/projects/${project.id}/lists/${list.id}/board`}
                className="text-xs text-gray-400 hover:text-blue-500"
              >
                Board
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
