import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Modal } from './Modal'

afterEach(cleanup)

function Workspace() {
  const [open, setOpen] = useState(false)
  return <><button onClick={() => setOpen(true)}>Edit record</button>{open && <Modal title="Edit record" onClose={() => setOpen(false)}><label>Name<input /></label><button>Save</button></Modal>}</>
}

describe('shared modal', () => {
  it('focuses the form, locks page scrolling, and restores trigger focus on Escape', () => {
    render(<Workspace />)
    const trigger = screen.getByRole('button', { name: 'Edit record' })
    trigger.focus()
    fireEvent.click(trigger)
    const dialog = screen.getByRole('dialog', { name: 'Edit record' })
    expect(dialog).toHaveAttribute('open')
    expect(screen.getByLabelText('Name')).toHaveFocus()
    expect(document.body.style.overflow).toBe('hidden')
    fireEvent(dialog, new Event('cancel', { cancelable: true }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
    expect(document.body.style.overflow).toBe('')
  })

  it('supports a close button and does not discard a draft on a backdrop click', () => {
    render(<Workspace />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit record' }))
    fireEvent.click(screen.getByRole('dialog'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('blocks Escape, closing, and form interaction during a save', () => {
    const onClose = vi.fn()
    render(<Modal title="Saving record" busy onClose={onClose}><label>Name<input /></label><button>Cancel</button></Modal>)
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }))
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Close dialog' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    expect(screen.getByLabelText('Name')).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent('Saving changes')
  })
})
