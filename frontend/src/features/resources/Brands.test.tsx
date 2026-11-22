import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import { apiClient } from '../../services/api-client'
import { ResourcePage } from './ResourcePage'
import { GenericRecordForm } from './GenericRecordForm'

vi.mock('../auth/use-current-user', () => ({ useCurrentUser: () => ({ data: { roles: ['super-admin'], permissions: [] } }) }))
afterEach(() => { cleanup(); vi.restoreAllMocks() })
const rows = [{ id: 1, name: 'AMD', status: 'active', products_count: 2 }, { id: 2, name: 'Unused', status: 'active', products_count: 0 }]
function workspace() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/modules/brands']}><Routes><Route path="/modules/:resource" element={<ResourcePage />} /></Routes></MemoryRouter></QueryClientProvider>)
}

it('creates a brand in a popup without a manual identifier', async () => {
  vi.spyOn(apiClient, 'get').mockResolvedValue({ data: { data: rows } } as never)
  const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: {} } as never)
  workspace()
  fireEvent.click(screen.getByRole('button', { name: 'New brand' }))
  const dialog = screen.getByRole('dialog', { name: 'Create brand' })
  fireEvent.change(within(dialog).getByLabelText(/Brand name/), { target: { value: 'Intel' } })
  await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Save record' })).toBeEnabled())
  fireEvent.click(within(dialog).getByRole('button', { name: 'Save record' }))
  await waitFor(() => expect(post).toHaveBeenCalledWith('/api/v1/brands', { name: 'Intel', status: 'active' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
})

it('edits brand name and availability in a popup', async () => {
  vi.spyOn(apiClient, 'get').mockResolvedValue({ data: { data: rows } } as never)
  const put = vi.spyOn(apiClient, 'put').mockResolvedValue({ data: {} } as never)
  workspace()
  const row = (await screen.findByText('AMD')).closest('tr')!
  fireEvent.click(within(row).getByRole('button', { name: 'Edit' }))
  const dialog = screen.getByRole('dialog', { name: 'Edit brand' })
  fireEvent.change(within(dialog).getByLabelText(/Brand name/), { target: { value: 'Advanced Micro Devices' } })
  fireEvent.change(within(dialog).getByLabelText('Status'), { target: { value: 'inactive' } })
  await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Save record' })).toBeEnabled())
  fireEvent.click(within(dialog).getByRole('button', { name: 'Save record' }))
  await waitFor(() => expect(put).toHaveBeenCalledWith('/api/v1/brands/1', { name: 'Advanced Micro Devices', status: 'inactive' }))
})

it('blocks deletion of used brands and confirms unused brand deletion', async () => {
  vi.spyOn(apiClient, 'get').mockResolvedValue({ data: { data: rows } } as never)
  const remove = vi.spyOn(apiClient, 'delete').mockResolvedValue({ data: {} } as never)
  workspace()
  fireEvent.click(within((await screen.findByText('AMD')).closest('tr')!).getByRole('button', { name: 'Delete' }))
  expect(screen.getByRole('button', { name: 'Delete brand' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  fireEvent.click(within(screen.getByText('Unused').closest('tr')!).getByRole('button', { name: 'Delete' }))
  expect(remove).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Delete brand' }))
  await waitFor(() => expect(remove).toHaveBeenCalledWith('/api/v1/brands/2'))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
})

it('searches brands and paginates the listing', async () => {
  const get = vi.spyOn(apiClient, 'get').mockResolvedValue({ data: { data: rows, next_page_url: '/api/v1/brands?page=2', current_page: 1, last_page: 2, total: 4 } } as never)
  workspace()
  fireEvent.change(screen.getByLabelText('Search brands'), { target: { value: 'AMD' } })
  await waitFor(() => expect(get).toHaveBeenCalledWith('/api/v1/brands', { params: { search: 'AMD', page: 1, per_page: 30, sort_by: 'id', sort_direction: 'desc' } }))
  fireEvent.click(await screen.findByRole('button', { name: 'Next' }))
  await waitFor(() => expect(get).toHaveBeenCalledWith('/api/v1/brands', { params: { search: 'AMD', page: 2, per_page: 30, sort_by: 'id', sort_direction: 'desc' } }))
})

it('loads all brand choice pages for product forms', async () => {
  const get = vi.spyOn(apiClient, 'get').mockImplementation(async (url, config) => ({ data: String(url).endsWith('/brands') ? (config?.params as { cursor?: string })?.cursor ? { data: [rows[1]] } : { data: [rows[0]], next_cursor: 'second' } : { data: [] } }) as never)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={client}><GenericRecordForm resource="products" onCancel={() => {}} onSaved={() => {}} /></QueryClientProvider>)
  await screen.findByRole('option', { name: 'Unused' })
  expect(get).toHaveBeenCalledWith('/api/v1/brands', { params: { per_page: 100, cursor: 'second' } })
})
