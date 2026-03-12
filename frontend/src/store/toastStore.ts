import { create } from 'zustand'

export type Toast = {
  id: string
  message: string
  type: 'error' | 'success' | 'info'
}

type ToastStore = {
  toasts: Toast[]
  add: (message: string, type?: Toast['type']) => void
  remove: (id: string) => void
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  add: (message, type = 'error') => {
    const id = crypto.randomUUID()
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }))
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 4000)
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

export const toast = {
  error: (message: string) => useToastStore.getState().add(message, 'error'),
  success: (message: string) => useToastStore.getState().add(message, 'success'),
  info: (message: string) => useToastStore.getState().add(message, 'info'),
}
