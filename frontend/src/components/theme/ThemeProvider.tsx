import { useCallback, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react'
import { parseTheme, ThemeContext, themeStorageKey, type Theme } from './theme-context'

function savedTheme(): Theme | null {
  try { return parseTheme(localStorage.getItem(themeStorageKey)) } catch { return null }
}

function systemTheme(): Theme {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function subscribeSystemTheme(listener: () => void) {
  const media = window.matchMedia?.('(prefers-color-scheme: dark)')
  media?.addEventListener('change', listener)
  return () => media?.removeEventListener('change', listener)
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState(savedTheme)
  const system = useSyncExternalStore(subscribeSystemTheme, systemTheme, () => 'light' as Theme)
  const theme = preference ?? system

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    const browserColour = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    if (browserColour) browserColour.content = getComputedStyle(document.documentElement).getPropertyValue('--surface').trim()
  }, [theme])

  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === themeStorageKey || event.key === null) setPreference(savedTheme())
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])

  const setTheme = useCallback((next: Theme) => {
    // The switch still works if browser storage is unavailable.
    try { localStorage.setItem(themeStorageKey, next) } catch { /* Keep this session's choice in memory. */ }
    setPreference(next)
  }, [])
  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
