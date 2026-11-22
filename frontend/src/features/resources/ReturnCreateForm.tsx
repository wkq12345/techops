import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { apiClient } from '../../services/api-client'
import { getFormError } from '../auth/form-error'
import { WarehousePicker } from './WarehousePicker'
import { InventoryLocationPicker } from './InventoryLocationPicker'
import { Choice, useCatalog } from './workflow-utils'
import { FormPanel } from '../../components/ui/FormPanel'
import { Field } from '../../components/ui/Field'

interface SaleLine { id: number; product_id: number; warehouse_id?: number | null; bin_id?: number | null; quantity: string; unit_price: string; product?: { name: string } }
interface SaleDetail { id: number; warehouse_id: number | null; items: SaleLine[] }

export function ReturnCreateForm({ onCancel, onSaved }: { onCancel: () => void; onSaved: () => void }) {
  const orders = useCatalog('sales-orders')
  const products = useCatalog('products')
  const client = useQueryClient()
  const [orderId, setOrderId] = useState('')
  const [warehouseId, setWarehouseId] = useState('')
  const [locationId, setLocationId] = useState('')
  const [lineId, setLineId] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [reason, setReason] = useState('defective')
  const [disposition, setDisposition] = useState('damaged')
  const [refund, setRefund] = useState('0')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const detail = useQuery({ queryKey: ['sales-order', orderId], enabled: Boolean(orderId), queryFn: async () => (await apiClient.get<{ data: SaleDetail }>(`/api/v1/sales-orders/${orderId}`)).data.data })
  const selectedLine = detail.data?.items.find(line => String(line.id) === lineId)
  const save = useMutation({
    mutationFn: async () => apiClient.post('/api/v1/sales-returns', { sales_order_id: Number(orderId), warehouse_id: Number(warehouseId), bin_id: Number(locationId), notes: notes || null, items: [{ sales_order_item_id: Number(lineId), quantity: Number(quantity), reason, disposition, refund_amount: Number(refund) }] }),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ['resource', 'sales-returns'] }); await client.invalidateQueries({ queryKey: ['resource', 'inventory'] }); await client.invalidateQueries({ queryKey: ['catalog'] }); await client.invalidateQueries({ queryKey: ['dashboard'] }); onSaved() },
  })
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedLine || !warehouseId || !locationId || Number(quantity) <= 0 || Number(quantity) > Number(selectedLine.quantity) || Number(refund) < 0) { setError('Select a sold item, inventory location and valid return quantity.'); return }
    setError(''); save.mutate()
  }
  return <FormPanel title="Create customer return">
    {(error || save.isError || detail.isError) && <div className="alert alert-error" role="alert">{error || (save.isError ? getFormError(save.error) : 'Could not load the sales order.')}</div>}
    <form onSubmit={submit}><div className="order-form-grid">
      <Choice label="Completed sales order" value={orderId} onChange={value => { setOrderId(value); setLineId(''); setLocationId(''); const order = orders.data?.find(row => String(row.id) === value); setWarehouseId(String(order?.warehouse_id ?? '')) }} rows={(orders.data ?? []).filter(row => row.status === 'completed')} required />
      <Field label="Sold item" required><select value={lineId} onChange={event => { const value = event.target.value; setLineId(value); const line = detail.data?.items.find(row => String(row.id) === value); setWarehouseId(String(line?.warehouse_id ?? detail.data?.warehouse_id ?? '')); setLocationId(String(line?.bin_id ?? '')); setRefund(line ? String(line.unit_price) : '0') }} required><option value="">Select item</option>{detail.data?.items.map(line => <option key={line.id} value={line.id}>{line.product?.name ?? products.data?.find(row => row.id === line.product_id)?.name ?? `Product #${line.product_id}`} — sold {line.quantity}</option>)}</select></Field>
      <WarehousePicker label="Return warehouse" value={warehouseId} onChange={value => { setWarehouseId(value); setLocationId('') }} disabled={!selectedLine} />
      <InventoryLocationPicker productId={selectedLine?.product_id ?? 0} warehouseId={Number(warehouseId)} locationId={locationId} onChange={location => setLocationId(location ? String(location.id) : '')} requireStock={false} disabled={!selectedLine} />
      <Field label="Quantity" required><input type="number" min="0.001" max={selectedLine?.quantity} step="any" value={quantity} onChange={event => setQuantity(event.target.value)} required /></Field>
      <Field label="Reason" required><select value={reason} onChange={event => setReason(event.target.value)} required>{['defective', 'wrong_item', 'customer_change', 'warranty_claim', 'damaged'].map(value => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}</select></Field>
      <Field label="Disposition" required><select value={disposition} onChange={event => setDisposition(event.target.value)} required>{['available', 'damaged', 'repair', 'supplier_return'].map(value => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}</select></Field>
      <Field label="Refund amount" required><input type="number" min="0" step="0.01" value={refund} onChange={event => setRefund(event.target.value)} required /></Field>
      <Field label="Notes"><textarea rows={2} value={notes} onChange={event => setNotes(event.target.value)} /></Field>
    </div><div className="order-form-footer"><span /><div><button className="button page-button" type="button" onClick={onCancel}>Cancel</button><button className="button compact-button" type="submit" disabled={save.isPending || orders.isLoading || detail.isLoading}>{save.isPending ? 'Saving…' : 'Create return'}</button></div></div></form>
  </FormPanel>
}
