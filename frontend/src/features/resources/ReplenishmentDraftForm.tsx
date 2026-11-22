import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { apiClient } from '../../services/api-client'
import { getFormError } from '../auth/form-error'
import { Button } from '../../components/ui/Button'
import { Field } from '../../components/ui/Field'
import { FormPanel } from '../../components/ui/FormPanel'
import { useCatalog } from './workflow-utils'

interface Suggestion { id: number; sku: string; name: string; available_quantity: number; reorder_level: number; suggested_quantity: number; unit_cost: number }
interface Page { data: Suggestion[] }

export function ReplenishmentDraftForm({ onCancel, onSaved }: { onCancel: () => void; onSaved: () => void }) {
  const client = useQueryClient()
  const suggestions = useQuery({ queryKey: ['inventory', 'replenishment-suggestions'], queryFn: async () => (await apiClient.get<Page>('/api/v1/inventory/replenishment-suggestions')).data.data })
  const suppliers = useCatalog('suppliers')
  const warehouses = useCatalog('warehouses')
  const [supplierId, setSupplierId] = useState('')
  const [warehouseId, setWarehouseId] = useState('')
  const [quantities, setQuantities] = useState<Record<number, string>>({})
  const [included, setIncluded] = useState<Record<number, boolean>>({})
  const create = useMutation({
    mutationFn: async () => {
      const rows = suggestions.data ?? []
      return apiClient.post('/api/v1/purchase-orders', { supplier_id: Number(supplierId), warehouse_id: Number(warehouseId), notes: 'Draft created from low-stock replenishment suggestions.', items: rows.filter(row => included[row.id] !== false).map(row => ({ product_id: row.id, quantity: Number(quantities[row.id] ?? row.suggested_quantity), unit_cost: row.unit_cost })) })
    },
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ['resource', 'purchase-orders'] }); await client.invalidateQueries({ queryKey: ['inventory', 'replenishment-suggestions'] }); onSaved() },
  })
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const rows = (suggestions.data ?? []).filter(row => included[row.id] !== false)
    if (!supplierId || !warehouseId || !rows.length || rows.some(row => Number(quantities[row.id] ?? row.suggested_quantity) <= 0)) return
    create.mutate()
  }
  return <FormPanel title="Replenishment draft" description="Suggested quantities bring each selected product back to its reorder level. This creates a purchase order pending approval; it does not order stock automatically.">
    {(create.isError || suggestions.isError) && <div className="alert alert-error" role="alert">{create.isError ? getFormError(create.error) : 'Could not load low-stock suggestions.'}</div>}
    {suggestions.isLoading ? <><div className="table-state">Checking stock levels…</div><div className="order-form-footer"><span /><Button onClick={onCancel}>Cancel</Button></div></> : !suggestions.data?.length ? <><div className="table-state">No products are currently below their reorder level.</div><div className="order-form-footer"><span /><Button onClick={onCancel}>Close</Button></div></> : <form onSubmit={submit}>
      <div className="order-form-grid">
        <Field label="Supplier" required><select value={supplierId} onChange={event => setSupplierId(event.target.value)} required><option value="">Select supplier</option>{suppliers.data?.filter(row => row.status === 'active').map(row => <option key={row.id} value={row.id}>{row.company_name ?? row.name}</option>)}</select></Field>
        <Field label="Receiving warehouse" required><select value={warehouseId} onChange={event => setWarehouseId(event.target.value)} required><option value="">Select warehouse</option>{warehouses.data?.filter(row => row.status === 'active').map(row => <option key={row.id} value={row.id}>{row.code} — {row.name}</option>)}</select></Field>
      </div>
      <div className="table-panel"><table><thead><tr><th>Include</th><th>Product</th><th>Available</th><th>Reorder level</th><th>Draft quantity</th><th>Unit cost</th></tr></thead><tbody>{suggestions.data.map(row => <tr key={row.id}><td><input type="checkbox" aria-label={`Include ${row.name}`} checked={included[row.id] !== false} onChange={event => setIncluded(current => ({ ...current, [row.id]: event.target.checked }))} /></td><td>{row.sku} — {row.name}</td><td>{row.available_quantity}</td><td>{row.reorder_level}</td><td><input aria-label={`Quantity for ${row.name}`} type="number" min="0.001" step="any" value={quantities[row.id] ?? row.suggested_quantity} onChange={event => setQuantities(current => ({ ...current, [row.id]: event.target.value }))} disabled={included[row.id] === false} /></td><td>RM {Number(row.unit_cost).toFixed(2)}</td></tr>)}</tbody></table></div>
      {(suppliers.isError || warehouses.isError) && <div className="alert alert-error" role="alert">Could not load suppliers or warehouses.</div>}
      <div className="order-form-footer"><span /><div><Button onClick={onCancel}>Cancel</Button><Button type="submit" variant="primary" disabled={create.isPending || suggestions.isLoading || suppliers.isLoading || warehouses.isLoading || suppliers.isError || warehouses.isError || !supplierId || !warehouseId || !suggestions.data.some(row => included[row.id] !== false)}>{create.isPending ? 'Saving draft…' : 'Create purchase draft'}</Button></div></div>
    </form>}
  </FormPanel>
}
