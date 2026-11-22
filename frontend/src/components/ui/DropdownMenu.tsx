import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import { Button } from './Button'

interface MenuItem {
  label: string
  icon: LucideIcon
  to?: string
  onSelect?: () => void
  variant?: 'default' | 'danger'
  disabled?: boolean
}

export function DropdownMenu({ label, trigger, heading, items }: {
  label: string
  trigger: ReactNode
  heading?: ReactNode
  items: MenuItem[]
}) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const root = useRef<HTMLDivElement>(null)
  const triggerButton = useRef<HTMLButtonElement | null>(null)
  const focusLast = useRef(false)
  const close = (restoreFocus = false) => { setOpen(false); if (restoreFocus) triggerButton.current?.focus() }
  useEffect(() => {
    if (!open) return
    const available = root.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)')
    available?.[focusLast.current ? available.length - 1 : 0]?.focus()
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false) }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open])
  return <div className="dropdown-menu" ref={root} onBlur={event => {
    if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false)
  }}>
    <Button variant="ghost" className="account-menu-trigger" aria-label={label} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined}
      onClick={event => { triggerButton.current = event.currentTarget; focusLast.current = false; setOpen(!open) }}
      onKeyDown={event => {
        if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
          event.preventDefault(); triggerButton.current = event.currentTarget; focusLast.current = event.key === 'ArrowUp'; setOpen(true)
        }
      }}>{trigger}</Button>
    {open && <div id={id} role="menu" aria-label={label} className="dropdown-menu-panel" onKeyDown={event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); return }
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
      event.preventDefault()
      const available = [...event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)')]
      if (!available.length) return
      const index = available.indexOf(document.activeElement as HTMLElement)
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? available.length - 1 : (index + (event.key === 'ArrowUp' ? -1 : 1) + available.length) % available.length
      available[next].focus()
    }}>
      {heading && <div className="dropdown-menu-heading" role="presentation">{heading}</div>}
      {items.map(({ label: itemLabel, icon: Icon, to, onSelect, variant = 'default', disabled }) => to
        ? <Link key={itemLabel} role="menuitem" tabIndex={-1} className={`dropdown-menu-item dropdown-menu-item--${variant}`} to={to} onClick={() => close()}><Icon aria-hidden="true" />{itemLabel}</Link>
        : <button key={itemLabel} role="menuitem" tabIndex={-1} type="button" disabled={disabled} className={`dropdown-menu-item dropdown-menu-item--${variant}`} onClick={() => { close(true); onSelect?.() }}><Icon aria-hidden="true" />{itemLabel}</button>)}
    </div>}
  </div>
}
