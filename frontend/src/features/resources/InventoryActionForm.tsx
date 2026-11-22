import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { apiClient } from '../../services/api-client'
import { getFormError } from '../auth/form-error'
import { WarehousePicker } from './WarehousePicker'
import { InventoryLocationPicker } from './InventoryLocationPicker'
import { Choice, useCatalog } from './workflow-utils'
import { Button } from '../../components/ui/Button'
import { Field } from '../../components/ui/Field'
import { FormPanel } from '../../components/ui/FormPanel'

export function InventoryActionForm({ mode, onCancel, onSaved }: { mode: 'adjust' | 'transfer'; onCancel: () => void; onSaved: () => void }) {
  const products = useCatalog('products')
  const client = useQueryClient()
  const [productId, setProductId] = useState('')
  const [warehouseId, setWarehouseId] = useState('')
  const [locationId, setLocationId] = useState('')
  const [destinationLocationId, setDestinationLocationId] = useState('')
  const [destinationId, setDestinationId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const save = useMutation({
    mutationFn: async () => {
      if (mode === 'adjust') await apiClient.post('/api/v1/stock-adjustments', { product_id: Number(productId), warehouse_id: Number(warehouseId), bin_id: Number(locationId), quantity_delta: Number(quantity), reason })
      else await apiClient.post('/api/v1/stock-transfers', { product_id: Number(productId), from_warehouse_id: Number(warehouseId), to_warehouse_id: Number(destinationId), from_bin_id: Number(locationId), to_bin_id: Number(destinationLocationId), quantity: Number(quantity) })
    },
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ['resource', 'inventory'] }); await client.invalidateQueries({ queryKey: ['resource', 'stock-movements'] }); await client.invalidateQueries({ queryKey: ['catalog'] }); await client.invalidateQueries({ queryKey: ['dashboard'] }); onSaved() },
  })
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!productId || !warehouseId || !locationId || !Number.isFinite(Number(quantity)) || Number(quantity) === 0 || (mode === 'transfer' && (Number(quantity) < 0 || !destinationId || !destinationLocationId || destinationLocationId === locationId))) {
      setError('Select a product and valid inventory location and quantity. Transfers require a different destination.'); return
    }
    setError(''); save.mutate()
  }
  return <FormPanel title={mode === 'adjust' ? 'Adjust stock' : 'Transfer stock'} description={mode === 'adjust' ? 'Add or remove quantity-tracked stock. Record a reason for the movement history.' : 'Move quantity-tracked stock between inventory locations.'}>
    {(error || save.isError || products.isError) && <div className="alert alert-error" role="alert">{error || (save.isError ? getFormError(save.error) : 'Could not load products or inventory locations.')}</div>}
    <form onSubmit={submit}><div className="order-form-grid">
      <Choice label="Product" value={productId} onChange={value => { setProductId(value); setWarehouseId(''); setLocationId(''); setDestinationId(''); setDestinationLocationId('') }} rows={(products.data ?? []).filter(row => row.tracking_type === 'quantity')} required />
      <WarehousePicker label={mode === 'adjust' ? 'Warehouse' : 'From warehouse'} value={warehouseId} onChange={value => { setWarehouseId(value); setLocationId('') }} disabled={!productId} />
      <InventoryLocationPicker productId={Number(productId)} warehouseId={Number(warehouseId)} locationId={locationId} onChange={location => setLocationId(location ? String(location.id) : '')} requireStock={mode === 'transfer' || Number(quantity) < 0} />
      {mode === 'transfer' && <>
        <WarehousePicker label="To warehouse" value={destinationId} onChange={value => { setDestinationId(value); setDestinationLocationId('') }} disabled={!productId} />
        <InventoryLocationPicker productId={Number(productId)} warehouseId={Number(destinationId)} locationId={destinationLocationId} onChange={location => setDestinationLocationId(location ? String(location.id) : '')} requireStock={false} />
      </>}
      <Field label={mode === 'adjust' ? 'Quantity change (+ or −)' : 'Quantity'} required hint={mode === 'adjust' ? 'Positive adds stock; negative removes stock.' : undefined}><input type="number" step="any" value={quantity} onChange={event => setQuantity(event.target.value)} required /></Field>
      {mode === 'adjust' && <Field label="Reason" required><textarea rows={2} value={reason} onChange={event => setReason(event.target.value)} required /></Field>}
    </div><div className="order-form-footer"><span /><div><Button onClick={onCancel}>Cancel</Button><Button variant="primary" type="submit" disabled={save.isPending || products.isLoading || products.isError}>{save.isPending ? 'Saving…' : mode === 'adjust' ? 'Save adjustment' : 'Transfer stock'}</Button></div></div></form>
  </FormPanel>
}
