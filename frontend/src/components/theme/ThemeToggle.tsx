import { Moon, Sun } from 'lucide-react'
import { Button } from '../ui/Button'
import { useTheme } from './theme-context'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const next = theme === 'dark' ? 'light' : 'dark'
  const Icon = theme === 'dark' ? Sun : Moon

  return <Button variant="ghost" size="icon" className="theme-toggle" aria-label={`Switch to ${next} mode`} title={`Switch to ${next} mode`} onClick={() => setTheme(next)}><Icon aria-hidden="true" /></Button>
}
