import { create } from 'zustand'

type UIState = {
  sidebarOpen: boolean
  activeTaskId: string | null
  workspaceId: string | null
  setSidebarOpen: (open: boolean) => void
  setActiveTaskId: (id: string | null) => void
  setWorkspaceId: (id: string | null) => void
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  activeTaskId: null,
  workspaceId: null,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setActiveTaskId: (id) => set({ activeTaskId: id }),
  setWorkspaceId: (id) => set({ workspaceId: id }),
}))
