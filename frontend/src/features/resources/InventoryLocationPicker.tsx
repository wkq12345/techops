import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { Button } from '../../components/ui/Button'
import { Field } from '../../components/ui/Field'
import { inventoryLocationQuery, warehouseLocationQuery, type InventoryLocationOption } from './inventory-location-queries'

export function InventoryLocationPicker({ productId, warehouseId, locationId, onChange, disabled = false, stockTracked = true, requireStock = true }: {
  productId: number
  warehouseId: number
  requireStock?: boolean
  locationId: string
  onChange: (location: InventoryLocationOption | undefined) => void
  disabled?: boolean
  stockTracked?: boolean
}) {
  const locations = useQuery({ ...(requireStock ? inventoryLocationQuery(productId, warehouseId) : warehouseLocationQuery(warehouseId)), enabled: Boolean(warehouseId && stockTracked && (!requireStock || productId)) })
  const selected = locations.data?.find(location => String(location.id) === locationId)
  const available = Number(selected?.available_quantity ?? 0)
  useEffect(() => {
    if (locationId || !stockTracked || !warehouseId || !locations.data) return
    const eligible = locations.data.filter(location => !requireStock || Number(location.available_quantity) > 0)
    if (eligible.length === 1) onChange(eligible[0])
  }, [locationId, stockTracked, warehouseId, locations.data, requireStock, onChange])
  return <div className="product-picker inventory-location-picker">
    <Field label="Inventory location" required={stockTracked} hint={!warehouseId ? 'Choose a warehouse first.' : !stockTracked ? 'Services do not require a stock location.' : selected && requireStock ? `${new Intl.NumberFormat('en-MY', { maximumFractionDigits: 3 }).format(Math.max(0, available))} available at this location.` : undefined}>
      <select value={locationId} onChange={event => onChange(locations.data?.find(location => String(location.id) === event.target.value))} required={stockTracked} disabled={disabled || !warehouseId || (requireStock && !productId) || !stockTracked || locations.isLoading || locations.isError}>
        <option value="">{!stockTracked ? 'Not required' : locations.isLoading ? 'Loading locations…' : 'Select inventory location'}</option>
        {locations.data?.map(location => <option key={location.id} value={location.id} disabled={requireStock && Number(location.available_quantity) <= 0}>{location.code} — {location.name}{requireStock ? ` · ${new Intl.NumberFormat('en-MY', { maximumFractionDigits: 3 }).format(Math.max(0, Number(location.available_quantity)))} available` : ''}</option>)}
      </select>
    </Field>
    {locations.isError && <div className="picker-feedback" role="alert">Could not load inventory locations.<Button size="small" onClick={() => void locations.refetch()}>Retry</Button></div>}
    {productId > 0 && warehouseId > 0 && requireStock && stockTracked && locations.isSuccess && !locations.data.some(location => Number(location.available_quantity) > 0) && <div className="picker-feedback" role="status">No stock is available at active locations.</div>}
  </div>
}
