import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '../../services/api-client'
import { ResourcePage } from './ResourcePage'

vi.mock('../auth/use-current-user', () => ({
  useCurrentUser: () => ({ data: { id: 1, name: 'Admin', roles: ['super-admin'], permissions: ['sales.create', 'sales.approve'] } }),
}))

afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('Sales Orders workspace', () => {
  it('creates an order from the New sales order button', async () => {
    vi.spyOn(apiClient, 'get').mockImplementation(async (url) => {
      const data = String(url).endsWith('/inventory-locations')
        ? [{ id: 7, warehouse_id: 1, code: 'BIN01', name: 'Rack A', status: 'active', available_quantity: 10 }]
        : String(url).endsWith('/warehouses') ? [{ id: 1, code: 'WH01', name: 'Main Shop', status: 'active' }]
        : String(url).endsWith('/products')
          ? [{ id: 2, sku: 'CPU-1', name: 'CPU', selling_price: '100.00', tracking_type: 'quantity', status: 'active' }]
          : []
      return { data: { data } } as never
    })
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: { data: { id: 1 } } } as never)
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/modules/sales-orders']}><Routes><Route path="/modules/:resource" element={<ResourcePage />} /></Routes></MemoryRouter></QueryClientProvider>)

    fireEvent.click(screen.getByRole('button', { name: 'New sales order' }))
    await screen.findByRole('heading', { name: 'Create sales order' })
    await screen.findByRole('option', { name: /CPU-1/ })
    fireEvent.change(screen.getByLabelText(/^Product/), { target: { value: '2' } })
    await screen.findByRole('option', { name: /WH01.*Main Shop/ })
    fireEvent.change(screen.getByLabelText(/^Warehouse/), { target: { value: '1' } })
    await screen.findByRole('option', { name: /BIN01.*Rack A/ })
    fireEvent.change(screen.getByLabelText(/^Inventory location/), { target: { value: '7' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create order' }))

    await waitFor(() => expect(post).toHaveBeenCalledWith('/api/v1/sales-orders', {
      customer_id: null,
      tax_rate: 0,
      notes: null,
      items: [{ product_id: 2, warehouse_id: 1, bin_id: 7, quantity: 1, inventory_unit_id: null }],
    }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
})

describe('module actions', () => {
  it.each([
    ['customers', 'New customer', 'Create customer'],
    ['suppliers', 'New supplier', 'Create supplier'],
    ['products', 'New product', 'Create product'],
    ['warehouses', 'New warehouse', 'Create warehouse'],
    ['warehouse-bins', 'New inventory location', 'Create inventory location'],
    ['warranties', 'New warranty', 'Create warranty'],
    ['inventory', 'Adjust stock', 'Adjust stock'],
    ['inventory', 'Transfer stock', 'Transfer stock'],
    ['repairs', 'New repair', 'Open repair job'],
    ['purchase-orders', 'New purchase order', 'Create purchase order'],
    ['pc-builds', 'New PC build', 'Create PC build'],
    ['returns', 'New return', 'Create customer return'],
  ])('opens the %s action', async (resource, button, heading) => {
    vi.spyOn(apiClient, 'get').mockResolvedValue({ data: { data: [] } } as never)
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[`/modules/${resource}`]}><Routes><Route path="/modules/:resource" element={<ResourcePage />} /></Routes></MemoryRouter></QueryClientProvider>)

    fireEvent.click(screen.getByRole('button', { name: button }))

    const dialog = await screen.findByRole('dialog', { name: heading })
    expect(within(dialog).getByRole('heading', { name: heading })).toBeInTheDocument()
    expect(document.querySelector('main form')).toBeNull()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('record edit modals', () => {
  it.each([
    ['customers', 'Customer code', 'customer_code', 'Name', { name: 'UPDATED' }, 'UPDATED'],
    ['suppliers', 'Supplier code', 'supplier_code', 'Company name', { company_name: 'UPDATED' }, 'UPDATED'],
    ['products', 'SKU', 'sku', 'Product name', { name: 'UPDATED', warranty_months: 0 }, 'UPDATED'],
    ['warehouses', 'Code', 'code', 'Warehouse name', { name: 'UPDATED' }, 'UPDATED'],
    ['warranties', 'Warranty number', 'number', 'Warranty period', { warranty_months: 24 }, '24'],
  ] as const)('opens the %s editor with an immutable code and saves editable fields', async (resource, label, field, editableLabel, expected, value) => {
    const row = { id: 4, [field]: 'ORIGINAL', name: 'Original record', company_name: 'Supplier', product_type: 'physical', tracking_type: 'quantity', status: 'active', warranty_months: 0, warranty_start: '2026-01-31', warranty_end: '2027-01-31' }
    vi.spyOn(apiClient, 'get').mockImplementation(async url => ({ data: { data: String(url).endsWith(`/${resource}`) ? [row] : [] } }) as never)
    const put = vi.spyOn(apiClient, 'put').mockResolvedValue({ data: { data: row } } as never)
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[`/modules/${resource}`]}><Routes><Route path="/modules/:resource" element={<ResourcePage />} /></Routes></MemoryRouter></QueryClientProvider>)
    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }))
    const dialog = screen.getByRole('dialog')
    const input = within(dialog).getByLabelText(new RegExp(`^${label}`))
    expect(input).toHaveValue('ORIGINAL')
    expect(input).toHaveAttribute('readonly')
    const editable = within(dialog).getByLabelText(new RegExp(`^${editableLabel}`))
    if (resource === 'warranties') expect(editable).toHaveValue(12)
    fireEvent.change(editable, { target: { value } })
    const submit = within(dialog).getByRole('button', { name: resource === 'products' ? 'Save changes' : 'Save record' })
    await waitFor(() => expect(submit).toBeEnabled())
    fireEvent.click(submit)
    await waitFor(() => expect(put).toHaveBeenCalledWith(`/api/v1/${resource}/4`, expect.objectContaining(expected)))
    expect(put.mock.calls[0][1]).not.toHaveProperty(field)
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('keeps failed saves open with validation feedback and the entered values', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue({ data: { data: [] } } as never)
    vi.spyOn(apiClient, 'post').mockRejectedValue(new Error('Save failed'))
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/modules/customers']}><Routes><Route path="/modules/:resource" element={<ResourcePage />} /></Routes></MemoryRouter></QueryClientProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'New customer' }))
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: 'New customer' } })
    fireEvent.submit(screen.getByRole('dialog').querySelector('form')!)
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByLabelText(/^Name/)).toHaveValue('New customer')
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled()
  })

  it('cannot dismiss a pending save and closes only after it succeeds', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue({ data: { data: [] } } as never)
    let finish!: (value: never) => void
    vi.spyOn(apiClient, 'post').mockImplementation(() => new Promise(resolve => { finish = resolve }) as never)
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/modules/customers']}><Routes><Route path="/modules/:resource" element={<ResourcePage />} /></Routes></MemoryRouter></QueryClientProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'New customer' }))
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: 'Pending customer' } })
    fireEvent.submit(screen.getByRole('dialog').querySelector('form')!)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled())
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Close dialog' })).toBeDisabled()
    finish({ data: { data: { id: 1 } } } as never)
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
})

describe('sales order record actions', () => {
  it('completes a confirmed sale from its row', async () => {
    vi.spyOn(apiClient, 'get').mockImplementation(async (url) => ({ data: { data: String(url).endsWith('/sales-orders/1')
      ? { id: 1, number: 'SO-1', status: 'confirmed', total: '100.00', items: [] }
      : String(url).endsWith('/sales-orders') ? [{ id: 1, number: 'SO-1', status: 'confirmed', total: '100.00' }] : [] } }) as never)
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: { data: { id: 1 } } } as never)
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/modules/sales-orders']}><Routes><Route path="/modules/:resource" element={<ResourcePage />} /></Routes></MemoryRouter></QueryClientProvider>)

    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }))
    expect(await screen.findByRole('dialog', { name: /Edit .*SO-1/ })).toBeInTheDocument()
    fireEvent.click(await screen.findByRole('button', { name: 'Complete sale' }))

    await waitFor(() => expect(post).toHaveBeenCalledWith('/api/v1/sales-orders/1/complete', { method: 'cash', reference: null }))
  })
})

describe('PC build record actions', () => {
  it('runs the compatibility endpoint using POST', async () => {
    vi.spyOn(apiClient, 'get').mockImplementation(async (url) => ({ data: { data: String(url).endsWith('/pc-builds/1')
      ? { id: 1, number: 'PCB-1', status: 'draft', items: [] }
      : String(url).endsWith('/pc-builds') ? [{ id: 1, number: 'PCB-1', status: 'draft' }] : [] } }) as never)
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: { data: { status: 'warning', results: [{ status: 'warning', message: 'More components needed' }] } } } as never)
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/modules/pc-builds']}><Routes><Route path="/modules/:resource" element={<ResourcePage />} /></Routes></MemoryRouter></QueryClientProvider>)

    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Check compatibility' }))

    await waitFor(() => expect(post).toHaveBeenCalledWith('/api/v1/pc-builds/1/validate'))
    expect(await screen.findByText('Result: warning')).toBeInTheDocument()
  })
})
