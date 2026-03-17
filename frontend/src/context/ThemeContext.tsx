import { createContext, useContext, ReactNode } from 'react'
import { useTheme } from '@/hooks/useTheme'

type ThemeContextValue = { theme: 'light' | 'dark'; toggleTheme: () => void }
const ThemeContext = createContext<ThemeContextValue>({ theme: 'light', toggleTheme: () => {} })

export function ThemeProvider({ children }: { children: ReactNode }) {
  const value = useTheme()
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export const useThemeContext = () => useContext(ThemeContext)
