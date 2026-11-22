import { createContext, useContext } from 'react'

export type Theme = 'light' | 'dark'
// Keep this key aligned with the pre-paint bootstrap in index.html.
export const themeStorageKey = 'techops-theme'

export function parseTheme(value: string | null): Theme | null {
  return value === 'light' || value === 'dark' ? value : null
}

export const ThemeContext = createContext<{ theme: Theme; setTheme: (theme: Theme) => void } | null>(null)

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used within ThemeProvider')
  return context
}
