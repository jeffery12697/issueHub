import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { projectsApi, type Project } from '@/api/projects'
import { listsApi, type List } from '@/api/lists'
import { useListTemplates, listTemplatesApi, type ListTemplate } from '@/api/listTemplates'
import WorkspaceHeader from '@/components/WorkspaceHeader'

export default function ProjectPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const qc = useQueryClient()

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
      <WorkspaceHeader workspaceId={workspaceId!} />

      <main className="max-w-4xl mx-auto py-10 px-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Projects</h2>
            <p className="text-sm text-slate-400 mt-0.5">
              {projects.length === 0 ? 'No projects yet' : `${projects.length} project${projects.length === 1 ? '' : 's'}`}
            </p>
          </div>
          <button
            onClick={() => setCreatingProject(true)}
            className="flex items-center gap-1.5 bg-violet-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-violet-700 transition-colors font-medium"
          >
            <span className="text-base leading-none">+</span> New project
          </button>
        </div>

        {creatingProject && (
          <form
            className="mb-4 bg-white border border-violet-200 rounded-xl p-4 shadow-sm flex gap-2"
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
            <button type="button" onClick={() => { setCreatingProject(false); setNewProjectName('') }} className="text-sm px-3 py-2 text-slate-500 hover:text-slate-700 transition-colors">Cancel</button>
          </form>
        )}

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="bg-white border border-slate-200 rounded-xl h-28 animate-pulse" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-20 bg-white border border-dashed border-slate-200 rounded-2xl">
            <div className="w-12 h-12 bg-violet-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-violet-400">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                <line x1="12" y1="11" x2="12" y2="17" />
                <line x1="9" y1="14" x2="15" y2="14" />
              </svg>
            </div>
            <p className="text-slate-700 font-medium mb-1">No projects yet</p>
            <p className="text-slate-400 text-sm mb-5">Create a project to organize your lists and tasks.</p>
            <button
              onClick={() => setCreatingProject(true)}
              className="bg-violet-600 text-white text-sm px-5 py-2 rounded-lg hover:bg-violet-700 transition-colors font-medium"
            >
              Create project
            </button>
          </div>
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

const PROJECT_COLORS = [
  'bg-violet-500', 'bg-sky-500', 'bg-emerald-500',
  'bg-amber-500', 'bg-rose-500', 'bg-indigo-500',
]

function projectColor(name: string) {
  return PROJECT_COLORS[name.charCodeAt(0) % PROJECT_COLORS.length]
}

function ProjectCard({ project, workspaceId, templates }: { project: Project; workspaceId: string; templates: ListTemplate[] }) {
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

  const dotColor = projectColor(project.name)

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      {/* Project header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className={`w-2.5 h-2.5 rounded-full ${dotColor} shrink-0`} />
          <h3 className="font-semibold text-slate-900 text-sm">{project.name}</h3>
          {lists.length > 0 && (
            <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
              {lists.length} {lists.length === 1 ? 'list' : 'lists'}
            </span>
          )}
        </div>
        <button
          onClick={() => setCreatingList(true)}
          className="text-xs text-violet-600 hover:text-violet-700 font-medium transition-colors flex items-center gap-1"
        >
          <span className="text-sm leading-none">+</span> New list
        </button>
      </div>

      {/* Create list form */}
      {creatingList && (
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
          <div className="flex gap-1 mb-2">
            {(['blank', 'template'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setCreateMode(mode)}
                className={`text-xs px-3 py-1 rounded-full font-medium transition-colors capitalize ${
                  createMode === mode
                    ? 'bg-violet-600 text-white'
                    : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                {mode === 'template' ? 'From template' : 'Blank'}
              </button>
            ))}
          </div>
          {createMode === 'blank' ? (
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); createList.mutate(newListName) }}>
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

      {/* List items */}
      <div className="px-5 py-2">
        {lists.length === 0 ? (
          <p className="text-slate-400 text-xs py-3">No lists yet — create one to start tracking tasks.</p>
        ) : (
          <ul className="divide-y divide-slate-50">
            {lists.map((list: List) => (
              <li key={list.id} className="flex items-center gap-3 py-2 group">
                <svg className="w-3.5 h-3.5 text-slate-300 shrink-0 group-hover:text-slate-400 transition-colors" fill="currentColor" viewBox="0 0 16 16">
                  <rect x="2" y="3" width="12" height="1.5" rx="0.75" />
                  <rect x="2" y="7.25" width="12" height="1.5" rx="0.75" />
                  <rect x="2" y="11.5" width="8" height="1.5" rx="0.75" />
                </svg>
                <Link
                  to={`/projects/${project.id}/lists/${list.id}`}
                  className="flex-1 text-sm text-slate-700 hover:text-violet-700 transition-colors font-medium"
                >
                  {list.name}
                </Link>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                  <Link
                    to={`/projects/${project.id}/lists/${list.id}`}
                    className="text-xs px-2.5 py-1 rounded-md border border-slate-200 text-slate-500 hover:border-violet-300 hover:text-violet-700 hover:bg-violet-50 transition-colors"
                  >
                    List
                  </Link>
                  <Link
                    to={`/projects/${project.id}/lists/${list.id}/board`}
                    className="text-xs px-2.5 py-1 rounded-md border border-slate-200 text-slate-500 hover:border-violet-300 hover:text-violet-700 hover:bg-violet-50 transition-colors"
                  >
                    Board
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
