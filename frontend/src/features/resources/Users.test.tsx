import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import { apiClient } from '../../services/api-client'
import { ResourcePage } from './ResourcePage'

const auth = vi.hoisted(() => ({ user: { id: 1, roles: ['admin'], permissions: ['users.manage', 'products.update', 'products.view'] } }))
vi.mock('../auth/use-current-user', () => ({ useCurrentUser: () => ({ data: auth.user }) }))
afterEach(() => { cleanup(); vi.restoreAllMocks(); auth.user.roles = ['admin'] })
const rows = [{ id: 1, name: 'Admin account', email: 'admin@example.test', role: 'admin' }, { id: 2, name: 'Staff account', email: 'staff@example.test', role: 'staff' }]
function workspace(resource = 'users') {
  vi.spyOn(apiClient, 'get').mockResolvedValue({ data: { data: rows } } as never)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[`/modules/${resource}`]}><Routes><Route path="/modules/:resource" element={<ResourcePage />} /></Routes></MemoryRouter></QueryClientProvider>)
}

it('creates a user with Admin/Staff role and confirmed password in a modal', async () => {
  const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: {} } as never)
  workspace()
  fireEvent.click(screen.getByRole('button', { name: 'New user' }))
  const dialog = screen.getByRole('dialog', { name: 'Create user' })
  fireEvent.change(within(dialog).getByLabelText(/^Name/), { target: { value: 'New User' } })
  fireEvent.change(within(dialog).getByLabelText(/^Email/), { target: { value: 'new@example.test' } })
  fireEvent.change(within(dialog).getByLabelText(/^Role/), { target: { value: 'staff' } })
  fireEvent.change(within(dialog).getByLabelText(/^Password/), { target: { value: 'A-long-password-123' } })
  fireEvent.change(within(dialog).getByLabelText(/^Confirm password/), { target: { value: 'A-long-password-123' } })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Create user' }))
  await waitFor(() => expect(post).toHaveBeenCalledWith('/api/v1/users', { name: 'New User', email: 'new@example.test', role: 'staff', password: 'A-long-password-123', password_confirmation: 'A-long-password-123' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
})

it('edits without sending an empty password and allows role changes', async () => {
  const put = vi.spyOn(apiClient, 'put').mockResolvedValue({ data: {} } as never)
  workspace()
  fireEvent.click(within((await screen.findByText('Staff account')).closest('tr')!).getByRole('button', { name: 'Edit' }))
  const dialog = screen.getByRole('dialog', { name: 'Edit user' })
  fireEvent.change(within(dialog).getByLabelText(/^Role/), { target: { value: 'admin' } })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }))
  await waitFor(() => expect(put).toHaveBeenCalledWith('/api/v1/users/2', { name: 'Staff account', email: 'staff@example.test', role: 'admin' }))
})

it('blocks self-delete and confirms deletion of another account', async () => {
  const remove = vi.spyOn(apiClient, 'delete').mockResolvedValue({ data: {} } as never)
  workspace()
  expect(within((await screen.findByText('Admin account')).closest('tr')!).getByRole('button', { name: 'Delete' })).toBeDisabled()
  fireEvent.click(within(screen.getByText('Staff account').closest('tr')!).getByRole('button', { name: 'Delete' }))
  expect(screen.getByText(/Business records and audit history will be retained/)).toBeInTheDocument()
  expect(remove).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Delete user' }))
  await waitFor(() => expect(remove).toHaveBeenCalledWith('/api/v1/users/2'))
})

it('does not show staff delete controls on operational directories', async () => {
  auth.user.roles = ['staff']
  workspace('brands')
  await screen.findByText('Admin account')
  expect(screen.getAllByRole('button', { name: 'Edit' })).toHaveLength(2)
  expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull()
})
