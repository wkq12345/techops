import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { apiClient } from '../../services/api-client'
import { getFormError } from '../auth/form-error'
import { Field } from '../../components/ui/Field'
import { Button } from '../../components/ui/Button'
import { WarehousePicker } from './WarehousePicker'
import { InventoryLocationPicker } from './InventoryLocationPicker'
import { availableInventoryUnitQuery } from './inventory-location-queries'
import { Choice, useCatalog } from './workflow-utils'

interface BuildItem { id: number; product_id: number; quantity?: string | number }
interface Line { warehouseId: string; binId: string; unitId: string }

export function PcBuildConvertForm({ buildId, items, onSaved }: { buildId: number; items: BuildItem[]; onSaved: () => void }) {
  const products = useCatalog('products')
  const client = useQueryClient()
  const [lines, setLines] = useState<Record<number, Line>>(() => Object.fromEntries(items.map(item => [item.id, { warehouseId: '', binId: '', unitId: '' }])))
  const [error, setError] = useState('')
  const update = (id: number, change: Partial<Line>) => setLines(current => ({ ...current, [id]: { ...current[id], ...change } }))
  const convert = useMutation({
    mutationFn: async () => apiClient.post(`/api/v1/pc-builds/${buildId}/convert`, { items: items.map(item => ({ pc_build_item_id: item.id, product_id: item.product_id, warehouse_id: Number(lines[item.id]?.warehouseId), bin_id: Number(lines[item.id]?.binId), inventory_unit_id: lines[item.id]?.unitId ? Number(lines[item.id].unitId) : null })) }),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ['resource', 'pc-builds'] }); await client.invalidateQueries({ queryKey: ['resource', 'sales-orders'] }); await client.invalidateQueries({ queryKey: ['resource', 'inventory'] }); onSaved() },
  })
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (items.some(item => { const line = lines[item.id]; const type = products.data?.find(product => product.id === item.product_id)?.tracking_type; return !line?.warehouseId || !line?.binId || ((type === 'serial' || type === 'imei') && !line.unitId) })) { setError('Choose an inventory location and any required serial or IMEI for every component.'); return }
    setError(''); convert.mutate()
  }
  return <form className="action-form" onSubmit={submit}>
    <h3>Create sales order from build</h3>
    <p>Select where each component will be reserved. The order uses the build customer and current product prices.</p>
    {(error || convert.isError) && <div className="alert alert-error" role="alert">{error || getFormError(convert.error)}</div>}
    {items.map(item => <PcBuildConversionLine key={item.id} item={item} product={products.data?.find(row => row.id === item.product_id)} line={lines[item.id]} update={change => update(item.id, change)} />)}
    <div className="order-form-footer"><span /><Button type="submit" variant="primary" disabled={convert.isPending || products.isLoading || products.isError}>{convert.isPending ? 'Creating order…' : 'Create sales order'}</Button></div>
  </form>
}

function PcBuildConversionLine({ item, product, line, update }: { item: BuildItem; product?: { name?: string; tracking_type?: string }; line?: Line; update: (change: Partial<Line>) => void }) {
  const serialized = product?.tracking_type === 'serial' || product?.tracking_type === 'imei'
  const units = useQuery({ ...availableInventoryUnitQuery(item.product_id, Number(line?.warehouseId), Number(line?.binId)), enabled: Boolean(serialized && line?.warehouseId && line?.binId) })
  return <div className="order-item-row purchase-line">
    <Field label="Component"><input value={product?.name ?? `Product #${item.product_id}`} readOnly /></Field>
    <Field label="Quantity"><input value={String(item.quantity ?? '')} readOnly /></Field>
    <WarehousePicker value={line?.warehouseId ?? ''} onChange={warehouseId => update({ warehouseId, binId: '', unitId: '' })} />
    <InventoryLocationPicker productId={item.product_id} warehouseId={Number(line?.warehouseId)} locationId={line?.binId ?? ''} onChange={location => update({ binId: location ? String(location.id) : '', unitId: '' })} disabled={!line?.warehouseId} />
    {serialized && <Choice label="Serial / IMEI" value={line?.unitId ?? ''} onChange={unitId => update({ unitId })} rows={units.data ?? []} required />}
  </div>
}
