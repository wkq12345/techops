import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '../../services/api-client'
import { GenericRecordForm } from './GenericRecordForm'

afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('server-assigned record codes', () => {
  it.each([
    ['customers', 'Customer code', 'customer_code', [['Name', 'Customer']], { name: 'Customer' }, 'Save record'],
    ['suppliers', 'Supplier code', 'supplier_code', [['Company name', 'Supplier']], { company_name: 'Supplier' }, 'Save record'],
    ['products', 'SKU', 'sku', [['Product name', 'Product'], ['Product type', 'physical'], ['Tracking', 'quantity']], { name: 'Product', product_type: 'physical', tracking_type: 'quantity', warranty_months: 0 }, 'Create product'],
    ['warehouses', 'Code', 'code', [['Warehouse name', 'Shop']], { name: 'Shop' }, 'Save record'],
    ['warranties', 'Warranty number', 'number', [['Warranty period', '12']], { warranty_months: 12 }, 'Save record'],
  ] as const)('hides the generated %s code and omits it from creation payloads', async (resource, label, key, fields, expected, buttonName) => {
    vi.spyOn(apiClient, 'get').mockResolvedValue({ data: { data: [] } } as never)
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: { data: { id: 1, [key]: 'GENERATED' } } } as never)
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const onSaved = vi.fn()
    render(<QueryClientProvider client={client}><MemoryRouter><GenericRecordForm resource={resource} onCancel={() => {}} onSaved={onSaved} /></MemoryRouter></QueryClientProvider>)
    expect(screen.queryByLabelText(new RegExp(`^${label}`))).not.toBeInTheDocument()
    for (const [fieldLabel, value] of fields) {
      fireEvent.change(screen.getByLabelText(new RegExp(`^${fieldLabel}`)), { target: { value } })
    }
    const submit = screen.getByRole('button', { name: buttonName })
    await waitFor(() => expect(submit).toBeEnabled())
    fireEvent.click(submit)
    await waitFor(() => expect(post).toHaveBeenCalledWith(`/api/v1/${resource}`, expect.objectContaining(expected)))
    expect(post.mock.calls[0][1]).not.toHaveProperty(key)
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
  })
})
