import { X } from 'lucide-react'
import { createContext, useContext, useId, useLayoutEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Button } from './Button'

const ModalContext = createContext(false)
export const useInModal = () => useContext(ModalContext)

// Mount only while open. Native modality traps focus and makes the workspace inert.
export function Modal({ title, size = 'default', busy = false, onClose, children }: {
  title: string
  size?: 'default' | 'wide'
  busy?: boolean
  onClose: () => void
  children: ReactNode
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useLayoutEffect(() => {
    const dialog = dialogRef.current!
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog.showModal()
    const firstField = dialog.querySelector<HTMLElement>('input:not([disabled]):not([readonly]), select:not([disabled]), textarea:not([disabled]):not([readonly])')
    firstField?.focus()
    return () => {
      dialog.close()
      document.body.style.overflow = previousOverflow
      if (trigger?.isConnected) trigger.focus()
    }
  }, [])

  return createPortal(<ModalContext value={true}>
    <dialog ref={dialogRef} className={`ui-modal ui-modal--${size}`} aria-labelledby={titleId} aria-modal="true" aria-busy={busy}
      onCancel={event => { event.preventDefault(); if (!busy) onClose() }}>
      <header className="ui-modal-header"><h2 id={titleId}>{title}</h2><Button variant="ghost" size="icon" aria-label="Close dialog" onClick={onClose} disabled={busy}><X /></Button></header>
      <div className="ui-modal-body"><fieldset className="ui-modal-fields" disabled={busy}>{children}</fieldset></div>
      {busy && <div className="ui-modal-progress" role="status">Saving changes. Please wait…</div>}
    </dialog>
  </ModalContext>, document.body)
}
