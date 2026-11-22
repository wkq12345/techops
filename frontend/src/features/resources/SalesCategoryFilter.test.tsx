import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '../../services/api-client'
import { SalesOrderCreateForm } from './SalesOrderCreateForm'

const categories = [{ id: 10, name: 'Components', parent_id: null }, { id: 11, name: 'CPUs', parent_id: 10 }, { id: 20, name: 'Computers', parent_id: null }]
const cpu = { id: 1, sku: 'CPU-1', name: 'CPU', category_id: 11, status: 'active', tracking_type: 'quantity', selling_price: '100.00' }
const notebook = { id: 2, sku: 'NB-1', name: 'Notebook', category_id: 20, status: 'active', tracking_type: 'serial', selling_price: '500.00' }

afterEach(() => { cleanup(); vi.restoreAllMocks() })

function setup() {
  const get = vi.spyOn(apiClient, 'get').mockImplementation(async (url, options) => {
    const category = (options?.params as Record<string, string> | undefined)?.category_id
    const data = String(url).endsWith('/categories') ? categories
      : String(url).endsWith('/products') ? category === '11' || category === '10' ? [cpu] : category === '20' ? [notebook] : [cpu, notebook]
        : String(url).endsWith('/warehouses') ? [{ id: 1, name: 'Main', code: 'WH-1', status: 'active' }]
        : String(url).endsWith('/inventory-locations') ? [{ id: 7, warehouse_id: 1, name: 'Rack A', code: 'BIN-7', status: 'active', available_quantity: 10 }]
          : String(url).endsWith('/inventory-units') ? [{ id: 5, product_id: 2, warehouse_id: 1, bin_id: 7, serial_number: 'SN-1', status: 'available' }] : []
    return { data: { data } } as never
  })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={client}><SalesOrderCreateForm onCancel={() => {}} onCreated={() => {}} /></QueryClientProvider>)
  return get
}

describe('sales line category filters', () => {
  it('requests the selected category, shows matching products, then submits the per-item location', async () => {
    const get = setup()
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: {} } as never)
    await screen.findByRole('option', { name: 'Components / CPUs' })
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: '11' } })
    await waitFor(() => expect(get).toHaveBeenCalledWith('/api/v1/products', expect.objectContaining({ params: expect.objectContaining({ category_id: '11', status: 'active' }) })))
    await screen.findByRole('option', { name: /CPU-1/ })
    expect(screen.queryByRole('option', { name: /NB-1/ })).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/^Product/), { target: { value: '1' } })
    await screen.findByRole('option', { name: /WH-1.*Main/ })
    fireEvent.change(screen.getByLabelText(/^Warehouse/), { target: { value: '1' } })
    await screen.findByRole('option', { name: /BIN-7.*Rack A/ })
    fireEvent.change(screen.getByLabelText(/^Inventory location/), { target: { value: '7' } })
    expect(document.querySelector('.order-form-footer strong')).toHaveTextContent('RM 100.00')
    fireEvent.click(screen.getByRole('button', { name: 'Create order' }))
    await waitFor(() => expect(post).toHaveBeenCalledWith('/api/v1/sales-orders', { customer_id: null, tax_rate: 0, notes: null, items: [{ product_id: 1, warehouse_id: 1, bin_id: 7, quantity: 1, inventory_unit_id: null }] }))
  })

  it('resets product, location, serial and price when changing category without affecting another line', async () => {
    setup()
    await screen.findByRole('option', { name: /NB-1/ })
    fireEvent.change(screen.getByLabelText(/^Product/), { target: { value: '2' } })
    await screen.findByRole('option', { name: /WH-1.*Main/ })
    fireEvent.change(screen.getByLabelText(/^Warehouse/), { target: { value: '1' } })
    await screen.findByRole('option', { name: /BIN-7.*Rack A/ })
    fireEvent.change(screen.getByLabelText(/^Inventory location/), { target: { value: '7' } })
    await screen.findByRole('option', { name: 'SN-1' })
    fireEvent.change(await screen.findByLabelText(/^Serial/), { target: { value: '5' } })
    fireEvent.click(screen.getByRole('button', { name: /Add item/ }))
    const rows = document.querySelectorAll<HTMLElement>('.sales-order-item')
    fireEvent.change(within(rows[1]).getByLabelText(/^Product/), { target: { value: '1' } })
    fireEvent.change(within(rows[0]).getByLabelText('Category'), { target: { value: '11' } })
    expect(within(rows[0]).getByLabelText(/^Product/)).toHaveValue('')
    expect(within(rows[0]).getByLabelText(/^Warehouse/)).toHaveValue('')
    expect(within(rows[0]).getByLabelText(/^Inventory location/)).toHaveValue('')
    expect(within(rows[0]).queryByLabelText(/^Serial/)).not.toBeInTheDocument()
    expect(within(rows[1]).getByLabelText(/^Product/)).toHaveValue('1')
    expect(document.querySelector('.order-form-footer strong')).toHaveTextContent('RM 100.00')
  })

  it('loads subsequent product pages without losing the category filter', async () => {
    const get = setup()
    get.mockImplementation(async (url, options) => {
      if (String(url).endsWith('/products')) return { data: (options?.params as Record<string, string> | undefined)?.cursor ? { data: [{ ...cpu, id: 3, sku: 'CPU-2' }], next_cursor: null } : { data: [cpu], next_cursor: 'next-page' } } as never
      return { data: { data: String(url).endsWith('/categories') ? categories : [] } } as never
    })
    await screen.findByRole('option', { name: 'Components / CPUs' })
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: '11' } })
    await screen.findByRole('button', { name: 'Load more products' })
    fireEvent.click(screen.getByRole('button', { name: 'Load more products' }))
    await screen.findByRole('option', { name: /CPU-2/ })
    expect(get).toHaveBeenCalledWith('/api/v1/products', expect.objectContaining({ params: expect.objectContaining({ category_id: '11', cursor: 'next-page' }) }))
    expect(screen.getByRole('option', { name: /CPU-1/ })).toBeInTheDocument()
  })
})
