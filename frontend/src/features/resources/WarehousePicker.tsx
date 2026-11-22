import { Field } from '../../components/ui/Field'
import { Button } from '../../components/ui/Button'
import { useCatalog } from './workflow-utils'
import { useCurrentUser } from '../auth/use-current-user'
import { useEffect } from 'react'

export function WarehousePicker({ value, onChange, disabled = false, required = true, label = 'Warehouse' }: {
  value: string; onChange: (value: string) => void; disabled?: boolean; required?: boolean; label?: string
}) {
  const warehouses = useCatalog('warehouses')
  const { data: user } = useCurrentUser()
  const preferenceKey = `techops:default-warehouse:${user?.id ?? 'guest'}`
  useEffect(() => {
    if (value || disabled || !required || !warehouses.data?.length) return
    const active = warehouses.data.filter(row => row.status === 'active')
    const saved = typeof localStorage === 'undefined' ? '' : localStorage.getItem(preferenceKey) ?? ''
    const preferred = active.find(row => String(row.id) === saved)
    if (preferred) onChange(String(preferred.id))
    else if (active.length === 1) onChange(String(active[0].id))
  }, [value, disabled, required, warehouses.data, preferenceKey, onChange])
  const select = (warehouseId: string) => {
    if (warehouseId && typeof localStorage !== 'undefined') localStorage.setItem(preferenceKey, warehouseId)
    onChange(warehouseId)
  }
  return <div className="product-picker">
    <Field label={label} required={required}>
      <select value={value} onChange={event => select(event.target.value)} required={required} disabled={disabled || !required || warehouses.isLoading || warehouses.isError}>
        <option value="">{!required ? 'Not required' : warehouses.isLoading ? 'Loading warehouses…' : 'Select warehouse'}</option>
        {warehouses.data?.filter(row => row.status === 'active').map(row => <option key={row.id} value={row.id}>{row.code} — {row.name}</option>)}
      </select>
    </Field>
    {warehouses.isError && <div className="picker-feedback" role="alert">Could not load warehouses.<Button size="small" onClick={() => void warehouses.refetch()}>Retry</Button></div>}
  </div>
}
