import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { apiClient } from '../../services/api-client'
import { getFormError } from '../auth/form-error'
import { Button } from '../../components/ui/Button'
import { Field } from '../../components/ui/Field'
import { InventoryLocationPicker } from './InventoryLocationPicker'
import { useCatalog } from './workflow-utils'

interface PurchaseLine { id: number; product_id: number; ordered_quantity?: string | number; received_quantity?: string | number | null }
interface PurchaseOrder { id: number; warehouse_id: number; items: PurchaseLine[] }
interface Product { id: number; name?: string; sku?: string; tracking_type?: string }
interface LineState { include: boolean; quantity: string; binId: string; serials: string }

export function GoodsReceiptForm({ order, onSaved }: { order: PurchaseOrder; onSaved: () => void }) {
  const client = useQueryClient()
  const products = useCatalog('products')
  const remaining = (item: PurchaseLine) => Number(item.ordered_quantity ?? 0) - Number(item.received_quantity ?? 0)
  const outstanding = order.items.filter(item => remaining(item) > 0)
  const [lines, setLines] = useState<Record<number, LineState>>(() => Object.fromEntries(outstanding.map(item => [item.id, { include: true, quantity: String(remaining(item)), binId: '', serials: '' }])))
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const update = (id: number, change: Partial<LineState>) => setLines(current => ({ ...current, [id]: { ...current[id], ...change } }))
  const receive = useMutation({
    mutationFn: async () => apiClient.post(`/api/v1/purchase-orders/${order.id}/receive`, { notes: notes || null, items: outstanding.filter(item => lines[item.id]?.include).map(item => ({ purchase_order_item_id: item.id, bin_id: Number(lines[item.id]?.binId), quantity: Number(lines[item.id]?.quantity), serials: lines[item.id]?.serials.split(/[\n,]+/).map(value => value.trim()).filter(Boolean) })) }),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ['detail', 'purchase-orders', order.id] }),
        client.invalidateQueries({ queryKey: ['resource', 'purchase-orders'] }),
        client.invalidateQueries({ queryKey: ['resource', 'goods-receipts'] }),
        client.invalidateQueries({ queryKey: ['resource', 'inventory'] }),
        client.invalidateQueries({ queryKey: ['dashboard'] }),
        client.invalidateQueries({ queryKey: ['reports'] }),
      ])
      onSaved()
    },
  })
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const selected = outstanding.filter(item => lines[item.id]?.include)
    if (!selected.length) { setError('Choose at least one line to receive.'); return }
    for (const item of selected) {
      const state = lines[item.id]
      const quantity = Number(state?.quantity)
      if (!state?.binId || !Number.isFinite(quantity) || quantity <= 0 || quantity > remaining(item)) { setError('Each selected line needs a location and a quantity within its outstanding balance.'); return }
      const tracking = products.data?.find(product => product.id === item.product_id)?.tracking_type
      if (tracking === 'serial' || tracking === 'imei') {
        const serials = state.serials.split(/[\n,]+/).map(value => value.trim()).filter(Boolean)
        if (!Number.isInteger(quantity) || serials.length !== quantity || new Set(serials).size !== serials.length) { setError(`Enter exactly ${quantity} distinct serial number(s) or IMEI(s) for each serialized line.`); return }
      }
    }
    setError('')
    receive.mutate()
  }
  return <form className="action-form" onSubmit={submit}>
    <h3>Receive goods</h3>
    <p>Outstanding quantities are filled in automatically. Uncheck lines not included in this delivery.</p>
    {(error || receive.isError) && <div className="alert alert-error" role="alert">{error || getFormError(receive.error)}</div>}
    <div className="order-items">{outstanding.map(item => <GoodsReceiptLine key={item.id} item={item} product={products.data?.find(product => product.id === item.product_id)} warehouseId={order.warehouse_id} state={lines[item.id]} remaining={remaining(item)} update={change => update(item.id, change)} />)}</div>
    <Field label="Receipt notes"><textarea rows={2} value={notes} onChange={event => setNotes(event.target.value)} /></Field>
    <Button type="submit" variant="primary" disabled={receive.isPending || products.isLoading || products.isError || outstanding.length === 0 || !outstanding.some(item => lines[item.id]?.include)}>{receive.isPending ? 'Receiving…' : `Receive ${outstanding.filter(item => lines[item.id]?.include).length} line(s)`}</Button>
  </form>
}

function GoodsReceiptLine({ item, product, warehouseId, state, remaining, update }: { item: PurchaseLine; product?: Product; warehouseId: number; state?: LineState; remaining: number; update: (change: Partial<LineState>) => void }) {
  const serialized = product?.tracking_type === 'serial' || product?.tracking_type === 'imei'
  const disabled = !state?.include
  return <div className="order-item-row goods-receipt-line">
    <Field label="Receive"><span><input type="checkbox" checked={state?.include ?? false} onChange={event => update({ include: event.target.checked })} /> Include this line</span></Field>
    <Field label="Product"><input value={product ? `${product.sku ?? ''} — ${product.name ?? ''}` : `Product #${item.product_id}`} readOnly /></Field>
    <Field label="Remaining"><input value={String(remaining)} readOnly /></Field>
    <Field label="Receive quantity" required><input type="number" min="0.001" max={remaining} step="any" value={state?.quantity ?? ''} onChange={event => update({ quantity: event.target.value })} disabled={disabled} required={Boolean(state?.include)} /></Field>
    <InventoryLocationPicker productId={item.product_id} warehouseId={warehouseId} locationId={state?.binId ?? ''} onChange={location => update({ binId: location ? String(location.id) : '' })} requireStock={false} disabled={disabled} />
    {serialized && <div className="goods-receipt-serial"><Field label="Serials / IMEIs (one per line)" required><textarea rows={2} value={state?.serials ?? ''} onChange={event => update({ serials: event.target.value })} disabled={disabled} required={Boolean(state?.include)} /></Field></div>}
  </div>
}
