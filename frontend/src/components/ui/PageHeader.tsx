import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

export function PageHeader({ title, description, section = 'Operations', actions }: { title: string; description: string; section?: string; actions?: ReactNode }) {
  return <header className="workspace-heading">
    <nav className="breadcrumbs" aria-label="Breadcrumb"><Link to="/dashboard">TechOps</Link><span aria-hidden="true">/</span><span>{section}</span></nav>
    <div className="workspace-heading-row"><div><h1>{title}</h1><p>{description}</p></div>{actions && <div className="resource-actions">{actions}</div>}</div>
  </header>
}
