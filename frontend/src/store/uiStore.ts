import { create } from 'zustand'

type UIState = {
  sidebarOpen: boolean
  activeTaskId: string | null
  setSidebarOpen: (open: boolean) => void
  setActiveTaskId: (id: string | null) => void
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  activeTaskId: null,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setActiveTaskId: (id) => set({ activeTaskId: id }),
}))
