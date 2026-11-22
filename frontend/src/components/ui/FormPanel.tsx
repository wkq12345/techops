import type { ReactNode } from 'react'
import { useInModal } from './Modal'
export function FormPanel({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  const inModal = useInModal()
  return <section className="panel record-form-panel" aria-label={title}>{(!inModal || description) && <div className="order-form-heading"><div>{!inModal && <h2>{title}</h2>}{description && <p>{description}</p>}</div></div>}{children}</section>
}
