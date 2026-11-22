import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, Cpu, LogOut, Menu, UserRound, X } from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Button } from '../ui/Button'
import { DropdownMenu } from '../ui/DropdownMenu'
import { ThemeToggle } from '../theme/ThemeToggle'
import { logout } from '../../features/auth/auth-api'
import { useCurrentUser } from '../../features/auth/use-current-user'
import { clearSessionCache } from '../../features/auth/session-cache'
import { getFormError } from '../../features/auth/form-error'
import { navigation, navigationGroups } from './navigation-config'

export function DashboardLayout() {
  const [open, setOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('techops-nav-collapsed') === 'true')
  const location = useLocation()
  const pageName = location.pathname === '/account' ? 'My account' : navigation.find(item => item.to === location.pathname)?.label ?? 'Workspace'
  const { data: user } = useCurrentUser()
  const visible = (item: typeof navigation[number]) => !item.permission || Boolean(user?.roles.some(role => ['admin', 'super-admin'].includes(role)) || user?.permissions.includes(item.permission))
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: async () => {
      await clearSessionCache(queryClient)
      navigate('/login', { replace: true })
    },
  })

  return (
    <div className={`app-shell${collapsed ? ' nav-collapsed' : ''}`}>
      <aside id="main-navigation" className={open ? 'sidebar sidebar-open' : 'sidebar'}>
        <div className="sidebar-brand"><span className="brand-mark"><Cpu /></span><span className="brand-name">TechOps</span><button className="icon-button mobile-only" aria-label="Close navigation" onClick={() => setOpen(false)}><X /></button></div>
        <nav aria-label="Main navigation">
          {navigationGroups.filter(group => group.items.some(visible)).map(group => {
            const GroupIcon = group.items[0].icon
            return (
              <details className="nav-group" key={group.label}>
                <summary className="nav-group-toggle" title={group.label}>
                  <GroupIcon className="nav-group-icon" aria-hidden="true" />
                  <span className="nav-group-label">{group.label}</span>
                  <ChevronDown className="nav-group-chevron" aria-hidden="true" />
                </summary>
                <div className="nav-group-items">
                  {group.items.filter(visible).map(({ label, icon: Icon, to }) => <NavLink key={label} to={to} title={collapsed ? label : undefined} aria-label={label} onClick={() => setOpen(false)}><Icon /><span className="nav-label">{label}</span></NavLink>)}
                </div>
              </details>
            )
          })}
        </nav>
      </aside>
      {open && <button className="sidebar-scrim" aria-label="Close navigation" onClick={() => setOpen(false)} />}
      <div className="workspace">
        <header className="topbar">
          <div className="topbar-start"><Button className="desktop-only" variant="ghost" size="icon" aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'} aria-expanded={!collapsed} aria-controls="main-navigation" onClick={() => { setCollapsed(!collapsed); localStorage.setItem('techops-nav-collapsed', String(!collapsed)) }}><Menu /></Button><Button className="mobile-only" variant="ghost" size="icon" aria-label={open ? 'Close navigation' : 'Open navigation'} aria-expanded={open} aria-controls="main-navigation" onClick={() => setOpen(!open)}><Menu /></Button><span className="topbar-title">{pageName}</span><span className="topbar-divider" /><span className="topbar-context">Retail & service operations</span></div>
          <div className="topbar-end">
            <ThemeToggle />
            <DropdownMenu label="Account menu" trigger={<>
              <span className="avatar">{user?.name.slice(0, 2).toUpperCase()}</span>
              <span className="account-menu-identity"><strong>{user?.name}</strong><small>{user?.roles[0]?.replaceAll('-', ' ')}</small></span>
              <ChevronDown aria-hidden="true" />
            </>} heading={<><strong>{user?.name}</strong><small>{user?.email}</small></>} items={[
              { label: 'My account', icon: UserRound, to: '/account' },
              { label: logoutMutation.isPending ? 'Signing out…' : 'Sign out', icon: LogOut, variant: 'danger', disabled: logoutMutation.isPending, onSelect: () => logoutMutation.mutate() },
            ]} />
          </div>
        </header>
        {logoutMutation.isError && <div className="alert alert-error session-alert" role="alert">Sign out failed: {getFormError(logoutMutation.error)} <Button size="small" onClick={() => logoutMutation.mutate()}>Retry sign out</Button></div>}
        <Outlet />
      </div>
    </div>
  )
}
