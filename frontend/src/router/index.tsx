import { Navigate, Route, Routes } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { authApi } from '@/api/auth'
import { useAuthStore } from '@/store/authStore'

import AppLayout from '@/components/AppLayout'
import LoginPage from '@/views/auth/LoginPage'
import AuthCallbackPage from '@/views/auth/AuthCallbackPage'
import WorkspacePage from '@/views/workspace/WorkspacePage'
import ProjectPage from '@/views/project/ProjectPage'
import ListPage from '@/views/list/ListPage'
import ListSettingsPage from '@/views/list/ListSettingsPage'
import BoardPage from '@/views/board/BoardPage'
import TaskDetailPage from '@/views/task/TaskDetailPage'
import WorkspaceSettingsPage from '@/views/workspace/WorkspaceSettingsPage'
import MyTasksPage from '@/views/workspace/MyTasksPage'
import AnalyticsPage from '@/views/workspace/AnalyticsPage'
import WorkloadPage from '@/views/workspace/WorkloadPage'
import ProjectTasksPage from '@/views/project/ProjectTasksPage'
import ProjectAnalyticsPage from '@/views/project/ProjectAnalyticsPage'
import ProjectGanttPage from '@/views/project/ProjectGanttPage'
import ProjectSettingsPage from '@/views/project/ProjectSettingsPage'
import EpicsPage from '@/views/project/EpicsPage'
import EpicDetailPage from '@/views/project/EpicDetailPage'
import EpicTimelinePage from '@/views/project/EpicTimelinePage'
import InviteAcceptPage from '@/views/workspace/InviteAcceptPage'
import DashboardPage from '@/views/workspace/DashboardPage'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { accessToken, setUser } = useAuthStore()

  const { isLoading, isError } = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const user = await authApi.me()
      setUser(user)
      return user
    },
    enabled: !!accessToken,
    retry: false,
  })

  if (!accessToken) return <Navigate to="/login" replace />
  if (isLoading) return (
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header skeleton */}
      <div className="h-14 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 flex items-center gap-3">
        <div className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-slate-700 animate-pulse" />
        <div className="w-32 h-4 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" />
        <div className="ml-auto flex gap-2">
          <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse" />
          <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse" />
        </div>
      </div>
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar skeleton */}
        <div className="w-56 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 p-4 flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-7 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse" style={{ width: `${70 + (i % 3) * 12}%` }} />
          ))}
        </div>
        {/* Content skeleton */}
        <div className="flex-1 p-6 flex flex-col gap-4">
          <div className="w-48 h-6 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" />
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 h-11" />
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-3.5">
                  <div className="w-4 h-4 rounded bg-slate-200 dark:bg-slate-700 animate-pulse shrink-0" />
                  <div className="flex-1 h-4 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" />
                  <div className="w-20 h-5 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse" />
                  <div className="w-16 h-4 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" />
                  <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
  if (isError) return <Navigate to="/login" replace />

  return <>{children}</>
}

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />

      <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
        <Route path="/invites/:token" element={<InviteAcceptPage />} />
        <Route path="/" element={<WorkspacePage />} />
        <Route path="/workspaces/:workspaceId" element={<ProjectPage />} />
        <Route path="/workspaces/:workspaceId/settings" element={<WorkspaceSettingsPage />} />
        <Route path="/workspaces/:workspaceId/my-tasks" element={<MyTasksPage />} />
        <Route path="/workspaces/:workspaceId/analytics" element={<AnalyticsPage />} />
        <Route path="/workspaces/:workspaceId/workload" element={<WorkloadPage />} />
        <Route path="/workspaces/:workspaceId/dashboard" element={<DashboardPage />} />
        <Route path="/projects/:projectId" element={<ProjectTasksPage />} />
        <Route path="/projects/:projectId/epics" element={<EpicsPage />} />
        <Route path="/projects/:projectId/epics/:epicId" element={<EpicDetailPage />} />
        <Route path="/projects/:projectId/epics/:epicId/timeline" element={<EpicTimelinePage />} />
        <Route path="/projects/:projectId/gantt" element={<ProjectGanttPage />} />
        <Route path="/projects/:projectId/analytics" element={<ProjectAnalyticsPage />} />
        <Route path="/projects/:projectId/settings" element={<ProjectSettingsPage />} />
        <Route path="/projects/:projectId/lists/:listId" element={<ListPage />} />
        <Route path="/projects/:projectId/lists/:listId/board" element={<BoardPage />} />
        <Route path="/projects/:projectId/lists/:listId/settings" element={<ListSettingsPage />} />
        <Route path="/tasks/:taskId" element={<TaskDetailPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
