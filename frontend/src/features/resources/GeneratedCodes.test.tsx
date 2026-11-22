import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '../../services/api-client'
import { GenericRecordForm } from './GenericRecordForm'

afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('server-assigned record codes', () => {
  it.each([
    ['customers', 'Customer code', 'customer_code'],
    ['suppliers', 'Supplier code', 'supplier_code'],
    ['products', 'SKU', 'sku'],
    ['warehouses', 'Code', 'code'],
    ['warranties', 'Warranty number', 'number'],
  ])('shows automatic generation and omits the %s code from creation payloads', async (resource, label, key) => {
    vi.spyOn(apiClient, 'get').mockResolvedValue({ data: { data: [] } } as never)
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: { data: { id: 1, [key]: 'GENERATED' } } } as never)
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const onSaved = vi.fn()
    render(<QueryClientProvider client={client}><MemoryRouter><GenericRecordForm resource={resource} onCancel={() => {}} onSaved={onSaved} /></MemoryRouter></QueryClientProvider>)
    const code = screen.getByLabelText(new RegExp(`^${label}`))
    expect(code).toHaveAttribute('readonly')
    expect(code).not.toBeRequired()
    expect(code).toHaveValue('')
    expect(code).toHaveAttribute('placeholder', 'Auto-generated on save')
    expect(screen.getByText('Assigned automatically when saved.')).toBeInTheDocument()
    fireEvent.submit(code.closest('form')!)
    await waitFor(() => expect(post).toHaveBeenCalledWith(`/api/v1/${resource}`, expect.any(Object)))
    expect(post.mock.calls[0][1]).not.toHaveProperty(key)
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
  })
})
