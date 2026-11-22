import { Cpu } from 'lucide-react'
import { Outlet } from 'react-router-dom'
import { ThemeToggle } from '../../components/theme/ThemeToggle'

export function AuthLayout() {
  return (
    <main className="staff-auth-page">
      <header className="staff-auth-bar"><span className="brand-mark"><Cpu aria-hidden="true" /></span><strong>TechOps</strong><span className="staff-auth-context">Retail & service operations</span><ThemeToggle /></header>
      <section className="staff-auth-panel" aria-label="Staff authentication"><Outlet /></section>
      <footer className="staff-auth-footer">Internal staff access</footer>
    </main>
  )
}
