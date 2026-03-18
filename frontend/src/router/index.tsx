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
  if (isLoading) return <div className="flex items-center justify-center h-screen text-gray-500">Loading...</div>
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
