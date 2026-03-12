import { create } from 'zustand'
import type { User } from '@/api/auth'

type AuthState = {
  user: User | null
  accessToken: string | null
  setUser: (user: User) => void
  setAccessToken: (token: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: localStorage.getItem('access_token'),

  setUser: (user) => set({ user }),

  setAccessToken: (token) => {
    localStorage.setItem('access_token', token)
    set({ accessToken: token })
  },

  logout: () => {
    localStorage.removeItem('access_token')
    set({ user: null, accessToken: null })
  },
}))
