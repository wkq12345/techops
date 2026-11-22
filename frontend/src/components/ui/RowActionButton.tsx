import type { ButtonHTMLAttributes } from 'react'
import { Eye, Pencil, Printer, Trash2 } from 'lucide-react'
import { Button } from './Button'

export function RowActionButton({ action, title, ...props }: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & { action: 'edit' | 'delete' | 'print' | 'manage' }) {
  const label = action === 'edit' ? 'Edit' : action === 'delete' ? 'Delete' : action === 'manage' ? 'Manage' : 'Print invoice'
  const Icon = action === 'edit' ? Pencil : action === 'delete' ? Trash2 : action === 'manage' ? Eye : Printer
  return <Button {...props} variant={action === 'delete' ? 'danger' : 'secondary'} size="icon" aria-label={label} title={title ?? label}><Icon aria-hidden="true" /></Button>
}
