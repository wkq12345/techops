import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import { apiClient } from '../../services/api-client'
import { GenericRecordForm } from './GenericRecordForm'
import { ResourcePage } from './ResourcePage'
import { categoryPath, eligibleParents } from './category-hierarchy'

vi.mock('../auth/use-current-user', () => ({ useCurrentUser: () => ({ data: { roles: ['super-admin'], permissions: [] } }) }))
afterEach(() => { cleanup(); vi.restoreAllMocks() })

const rows = [
  { id: 1, name: 'Components', parent_id: null, status: 'active', products_count: 0, children_count: 1 },
  { id: 2, name: 'CPUs', parent_id: 1, status: 'active', products_count: 1, children_count: 1 },
  { id: 3, name: 'AMD', parent_id: 2, status: 'active', products_count: 0, children_count: 0 },
  { id: 4, name: 'Empty', parent_id: null, status: 'active', products_count: 0, children_count: 0 },
]
function workspace() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/modules/categories']}><Routes><Route path="/modules/:resource" element={<ResourcePage />} /></Routes></MemoryRouter></QueryClientProvider>)
}

it('excludes the category and all descendants from eligible parents', () => {
  expect(eligibleParents(rows, 1).map(row => row.id)).toEqual([4])
  expect(categoryPath(rows[2], rows)).toBe('Components / CPUs / AMD')
})

it('loads every category page and creates categories without manual identifiers', async () => {
  const get = vi.spyOn(apiClient, 'get').mockImplementation(async (_url, config) => ({ data: (config?.params as { cursor?: string } | undefined)?.cursor ? { data: rows.slice(2), next_cursor: null } : { data: rows.slice(0, 2), next_cursor: 'second' } }) as never)
  const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: {} } as never)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={client}><GenericRecordForm resource="categories" onCancel={() => {}} onSaved={() => {}} /></QueryClientProvider>)
  await screen.findByRole('option', { name: 'Components / CPUs / AMD' })
  expect(get).toHaveBeenCalledTimes(2)
  fireEvent.change(screen.getByLabelText(/Category name/), { target: { value: 'GPUs' } })
  fireEvent.change(screen.getByLabelText('Parent category'), { target: { value: '1' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save record' }))
  await waitFor(() => expect(post).toHaveBeenCalledWith('/api/v1/categories', { name: 'GPUs', parent_id: 1, status: 'active' }))
})

it('opens an edit modal and persists parent, name, and status changes', async () => {
  vi.spyOn(apiClient, 'get').mockResolvedValue({ data: { data: rows } } as never)
  const put = vi.spyOn(apiClient, 'put').mockResolvedValue({ data: {} } as never)
  workspace()
  const row = (await screen.findByText('CPUs')).closest('tr')!
  fireEvent.click(within(row).getByRole('button', { name: 'Edit' }))
  const dialog = screen.getByRole('dialog', { name: 'Edit category' })
  await waitFor(() => expect(within(dialog).getByRole('option', { name: 'Components' })).toBeInTheDocument())
  expect(within(dialog).queryByRole('option', { name: 'Components / CPUs / AMD' })).toBeNull()
  fireEvent.change(screen.getByLabelText(/Category name/), { target: { value: 'Processors' } })
  fireEvent.change(screen.getByLabelText('Parent category'), { target: { value: '' } })
  fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'inactive' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save record' }))
  await waitFor(() => expect(put).toHaveBeenCalledWith('/api/v1/categories/2', { name: 'Processors', parent_id: null, status: 'inactive' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
})

it('requires confirmation to delete and blocks deletion of occupied categories', async () => {
  vi.spyOn(apiClient, 'get').mockResolvedValue({ data: { data: rows } } as never)
  const remove = vi.spyOn(apiClient, 'delete').mockResolvedValue({ data: {} } as never)
  workspace()
  const occupied = (await screen.findByText('Components')).closest('tr')!
  fireEvent.click(within(occupied).getByRole('button', { name: 'Delete' }))
  expect(screen.getByRole('button', { name: 'Delete category' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  const empty = screen.getByText('Empty').closest('tr')!
  fireEvent.click(within(empty).getByRole('button', { name: 'Delete' }))
  expect(remove).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Delete category' }))
  await waitFor(() => expect(remove).toHaveBeenCalledWith('/api/v1/categories/4'))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
})
