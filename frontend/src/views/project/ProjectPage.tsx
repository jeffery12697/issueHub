import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { workspacesApi } from '@/api/workspaces'
import { projectsApi, type Project } from '@/api/projects'
import { listsApi, type List } from '@/api/lists'
import { useListTemplates, listTemplatesApi, type ListTemplate } from '@/api/listTemplates'
import HeaderActions from '@/components/HeaderActions'

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

  const { data: templates = [] } = useListTemplates(workspaceId)

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
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 h-14 flex items-center gap-3">
        <Link to="/" className="text-slate-400 hover:text-slate-600 text-sm transition-colors">← Workspaces</Link>
        <span className="text-slate-300">/</span>
        <span className="text-sm font-medium text-slate-800">{workspace?.name}</span>
        <div className="ml-auto flex items-center gap-3">
          <Link
            to={`/workspaces/${workspaceId}/my-tasks`}
            className="text-xs text-slate-400 hover:text-violet-600 transition-colors font-medium"
          >
            My Tasks
          </Link>
          <Link
            to={`/workspaces/${workspaceId}/settings`}
            className="text-xs text-slate-400 hover:text-violet-600 transition-colors font-medium"
          >
            ⚙ Templates
          </Link>
          <HeaderActions />
        </div>
      </header>

      <main className="max-w-4xl mx-auto py-10 px-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-slate-900">Projects</h2>
          <button
            onClick={() => setCreatingProject(true)}
            className="bg-violet-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-violet-700 transition-colors font-medium"
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
              className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
            <button type="submit" className="bg-violet-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-violet-700 transition-colors">Create</button>
            <button type="button" onClick={() => setCreatingProject(false)} className="text-sm px-3 py-2 text-slate-500 hover:text-slate-700 transition-colors">Cancel</button>
          </form>
        )}

        {isLoading ? (
          <p className="text-slate-400 text-sm">Loading...</p>
        ) : (
          <div className="space-y-4">
            {projects.map((project: Project) => (
              <ProjectCard key={project.id} project={project} workspaceId={workspaceId!} templates={templates} />
            ))}
          </div>
        )}

      </main>
    </div>
  )
}

function ProjectCard({ project, templates }: { project: Project; workspaceId: string; templates: ListTemplate[] }) {
  const qc = useQueryClient()
  const [newListName, setNewListName] = useState('')
  const [creatingList, setCreatingList] = useState(false)
  const [createMode, setCreateMode] = useState<'blank' | 'template'>('blank')
  const [selectedTemplate, setSelectedTemplate] = useState('')

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

  const createListFromTemplate = useMutation({
    mutationFn: ({ name, templateId }: { name: string; templateId: string }) =>
      listTemplatesApi.createListFromTemplate(project.id, { name, template_id: templateId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lists', project.id] })
      setCreatingList(false)
      setNewListName('')
    },
  })

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-slate-900 text-base flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-violet-400 inline-block shrink-0" />
          {project.name}
        </h3>
        <button
          onClick={() => setCreatingList(true)}
          className="text-xs text-violet-600 hover:text-violet-700 font-medium transition-colors"
        >
          + New list
        </button>
      </div>

      {creatingList && (
        <div className="mb-3">
          {/* Mode toggle */}
          <div className="flex gap-1 mb-2">
            <button
              type="button"
              onClick={() => setCreateMode('blank')}
              className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${
                createMode === 'blank'
                  ? 'bg-violet-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Blank
            </button>
            <button
              type="button"
              onClick={() => setCreateMode('template')}
              className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${
                createMode === 'template'
                  ? 'bg-violet-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              From template
            </button>
          </div>

          {createMode === 'blank' ? (
            <form
              className="flex gap-2"
              onSubmit={(e) => { e.preventDefault(); createList.mutate(newListName) }}
            >
              <input
                autoFocus
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                placeholder="List name"
                className="flex-1 border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
              <button type="submit" className="bg-violet-600 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-violet-700 transition-colors">Create</button>
              <button type="button" onClick={() => setCreatingList(false)} className="text-xs px-2 text-slate-500 hover:text-slate-700 transition-colors">Cancel</button>
            </form>
          ) : (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                if (!newListName.trim() || !selectedTemplate) return
                createListFromTemplate.mutate({ name: newListName.trim(), templateId: selectedTemplate })
              }}
            >
              <input
                autoFocus
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                placeholder="List name"
                className="flex-1 border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
              <select
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value)}
                className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                <option value="">Template…</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <button type="submit" className="bg-violet-600 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-violet-700 transition-colors">Create</button>
              <button type="button" onClick={() => setCreatingList(false)} className="text-xs px-2 text-slate-500 hover:text-slate-700 transition-colors">Cancel</button>
            </form>
          )}
        </div>
      )}

      {lists.length === 0 ? (
        <p className="text-slate-400 text-xs">No lists yet.</p>
      ) : (
        <ul className="space-y-0.5">
          {lists.map((list: List) => (
            <li key={list.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-slate-50 group transition-colors">
              <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" viewBox="0 0 16 16">
                <rect x="2" y="3" width="12" height="1.5" rx="0.75" fill="currentColor" />
                <rect x="2" y="7.25" width="12" height="1.5" rx="0.75" fill="currentColor" />
                <rect x="2" y="11.5" width="8" height="1.5" rx="0.75" fill="currentColor" />
              </svg>
              <Link
                to={`/projects/${project.id}/lists/${list.id}`}
                className="flex-1 text-sm text-slate-700 hover:text-slate-900 transition-colors"
              >
                {list.name}
              </Link>
              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                <Link
                  to={`/projects/${project.id}/lists/${list.id}`}
                  className="text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 hover:bg-violet-100 hover:text-violet-700 transition-colors"
                >
                  List
                </Link>
                <Link
                  to={`/projects/${project.id}/lists/${list.id}/board`}
                  className="text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 hover:bg-violet-100 hover:text-violet-700 transition-colors"
                >
                  Board
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
