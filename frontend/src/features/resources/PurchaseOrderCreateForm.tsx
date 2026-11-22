import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { apiClient } from '../../services/api-client'
import { getFormError } from '../auth/form-error'
import { Choice, optionLabel, useCatalog } from './workflow-utils'
import { FormPanel } from '../../components/ui/FormPanel'
import { Field } from '../../components/ui/Field'

interface Line { key: string; productId: string; quantity: string; cost: string }
const newLine = (): Line => ({ key: crypto.randomUUID(), productId: '', quantity: '1', cost: '' })

export function PurchaseOrderCreateForm({ onCancel, onSaved }: { onCancel: () => void; onSaved: () => void }) {
  const suppliers = useCatalog('suppliers')
  const warehouses = useCatalog('warehouses')
  const products = useCatalog('products')
  const client = useQueryClient()
  const [supplierId, setSupplierId] = useState('')
  const [warehouseId, setWarehouseId] = useState('')
  const [expectedAt, setExpectedAt] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<Line[]>([newLine()])
  const [error, setError] = useState('')
  const update = (key: string, change: Partial<Line>) => setLines(current => current.map(line => line.key === key ? { ...line, ...change } : line))
  const save = useMutation({
    mutationFn: async () => apiClient.post('/api/v1/purchase-orders', { supplier_id: Number(supplierId), warehouse_id: Number(warehouseId), expected_at: expectedAt || null, notes: notes || null, items: lines.map(line => ({ product_id: Number(line.productId), quantity: Number(line.quantity), unit_cost: Number(line.cost) })) }),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ['resource', 'purchase-orders'] }); onSaved() },
  })
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (lines.some(line => !line.productId || Number(line.quantity) <= 0 || line.cost === '' || Number(line.cost) < 0)) { setError('Each line needs a product, positive quantity and unit cost.'); return }
    setError(''); save.mutate()
  }
  return <FormPanel title="Create purchase order">
    {(error || save.isError) && <div className="alert alert-error" role="alert">{error || getFormError(save.error)}</div>}
    <form onSubmit={submit}><div className="order-form-grid">
      <Choice label="Supplier" value={supplierId} onChange={setSupplierId} rows={(suppliers.data ?? []).filter(row => row.status === 'active')} required />
      <Choice label="Receiving warehouse" value={warehouseId} onChange={setWarehouseId} rows={(warehouses.data ?? []).filter(row => row.status === 'active')} required />
      <Field label="Expected date"><input type="date" value={expectedAt} onChange={event => setExpectedAt(event.target.value)} /></Field>
      <Field label="Notes"><textarea rows={2} value={notes} onChange={event => setNotes(event.target.value)} /></Field>
    </div><div className="order-items-heading"><h3>Order lines</h3><button className="button page-button" type="button" onClick={() => setLines(current => [...current, newLine()])}><Plus /> Add item</button></div>
      <div className="order-items">{lines.map(line => <div className="order-item-row purchase-line" key={line.key}>
        <Field label="Product" required><select value={line.productId} onChange={event => { const product = products.data?.find(row => String(row.id) === event.target.value); update(line.key, { productId: event.target.value, cost: product?.cost_price ?? '' }) }} required><option value="">Select product</option>{products.data?.filter(row => row.status === 'active' && row.tracking_type !== 'none').map(row => <option key={row.id} value={row.id}>{optionLabel(row)}</option>)}</select></Field>
        <Field label="Quantity" required><input type="number" min="0.001" step="any" value={line.quantity} onChange={event => update(line.key, { quantity: event.target.value })} required /></Field>
        <Field label="Unit cost" required><input type="number" min="0" step="0.01" value={line.cost} onChange={event => update(line.key, { cost: event.target.value })} required /></Field>
        <button className="icon-button remove-item" type="button" onClick={() => setLines(current => current.filter(item => item.key !== line.key))} disabled={lines.length === 1} aria-label="Remove item"><Trash2 /></button>
      </div>)}</div>
      <div className="order-form-footer"><span /><div><button className="button page-button" type="button" onClick={onCancel}>Cancel</button><button className="button compact-button" type="submit" disabled={save.isPending || suppliers.isLoading || warehouses.isLoading || products.isLoading}>{save.isPending ? 'Saving…' : 'Create purchase order'}</button></div></div>
    </form>
  </FormPanel>
}
