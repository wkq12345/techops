import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { getFormError } from '../auth/form-error'
import { apiClient } from '../../services/api-client'
import { FormPanel } from '../../components/ui/FormPanel'
import { Field } from '../../components/ui/Field'
import { Button } from '../../components/ui/Button'
import { CategoryProductPicker, type ProductOption } from './CategoryProductPicker'
import { WarehousePicker } from './WarehousePicker'
import { InventoryLocationPicker } from './InventoryLocationPicker'
import { availableInventoryUnitQuery, inventoryLocationQuery, type AvailableInventoryUnit, type InventoryLocationOption } from './inventory-location-queries'

interface Page<T> { data: T[]; next_cursor?: string | null }
interface Customer { id: number; name: string; customer_code: string }
interface OrderItem { key: string; categoryId: string; productId: string; product?: ProductOption; warehouseId: string; locationId: string; quantity: string; unitId: string }

const newItem = (): OrderItem => ({ key: crypto.randomUUID(), categoryId: '', productId: '', warehouseId: '', locationId: '', quantity: '1', unitId: '' })
const money = (amount: number) => new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(amount)

async function list<T>(resource: string): Promise<T[]> {
  const rows: T[] = []
  let cursor: string | null = null
  do {
    const response: Page<T> = (await apiClient.get<Page<T>>(`/api/v1/${resource}`, { params: { per_page: 100, cursor: cursor || undefined } })).data
    rows.push(...response.data); cursor = response.next_cursor ?? null
  } while (cursor)
  return rows
}

export function SalesOrderCreateForm({ onCancel, onCreated }: { onCancel: () => void; onCreated: () => void }) {
  const queryClient = useQueryClient()
  const customers = useQuery({ queryKey: ['order-form', 'customers'], queryFn: () => list<Customer>('customers') })
  const [customerId, setCustomerId] = useState('')
  const [taxPercent, setTaxPercent] = useState('0')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<OrderItem[]>([newItem()])
  const [formError, setFormError] = useState('')

  const updateItem = (key: string, change: Partial<OrderItem>) => {
    setItems(current => current.map(item => item.key === key ? { ...item, ...change } : item))
  }
  const subtotal = items.reduce((sum, item) => sum + Number(item.product?.selling_price ?? 0) * Number(item.quantity || 0), 0)
  const estimatedTotal = subtotal * (1 + Number(taxPercent || 0) / 100)
  const loading = customers.isLoading
  const loadFailed = customers.isError

  const createOrder = useMutation({
    mutationFn: async () => {
      await apiClient.post('/api/v1/sales-orders', {
        customer_id: customerId ? Number(customerId) : null,
        tax_rate: Number(taxPercent) / 100,
        notes: notes.trim() || null,
        items: items.map(item => ({
          product_id: Number(item.productId),
          warehouse_id: item.warehouseId ? Number(item.warehouseId) : null,
          bin_id: item.locationId ? Number(item.locationId) : null,
          quantity: Number(item.quantity),
          inventory_unit_id: item.unitId ? Number(item.unitId) : null,
        })),
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['resource', 'sales-orders'] })
      await queryClient.invalidateQueries({ queryKey: ['resource', 'inventory'] })
      await queryClient.invalidateQueries({ queryKey: ['catalog', 'inventory-locations'] })
      await queryClient.invalidateQueries({ queryKey: ['catalog', 'available-inventory-units'] })
      onCreated()
    },
    onError: async () => {
      await queryClient.invalidateQueries({ queryKey: ['catalog', 'inventory-locations'] })
      await queryClient.invalidateQueries({ queryKey: ['catalog', 'available-inventory-units'] })
    },
  })

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError('')
    if (!items.length || items.some(item => !item.productId || !Number.isFinite(Number(item.quantity)) || Number(item.quantity) <= 0)) {
      setFormError('Choose a product and a quantity greater than zero for each item.'); return
    }
    if (items.some(item => {
      const tracking = item.product?.tracking_type
      return (tracking === 'serial' || tracking === 'imei') && (Number(item.quantity) !== 1 || !item.unitId)
    })) { setFormError('Select one serial or IMEI unit for each serialized item.'); return }
    const demand = new Map<string, number>()
    const selectedUnits = new Set<string>()
    for (const [index, item] of items.entries()) {
      if (item.product?.tracking_type === 'none') continue
      const locations = queryClient.getQueryData<InventoryLocationOption[]>(inventoryLocationQuery(Number(item.productId), Number(item.warehouseId)).queryKey)
      const location = locations?.find(row => String(row.id) === item.locationId)
      if (!location || location.warehouse_id !== Number(item.warehouseId) || location.status !== 'active') { setFormError(`Select an active inventory location for item ${index + 1}.`); return }
      const key = `${item.productId}:${item.locationId}`
      const quantity = (demand.get(key) ?? 0) + Number(item.quantity)
      demand.set(key, quantity)
      if (quantity > Number(location.available_quantity)) { setFormError(`The combined quantity for ${item.product?.name} exceeds available stock at ${location.name}.`); return }
      if (item.unitId) {
        const units = queryClient.getQueryData<AvailableInventoryUnit[]>(availableInventoryUnitQuery(Number(item.productId), Number(item.warehouseId), Number(item.locationId)).queryKey)
        if (selectedUnits.has(item.unitId) || !units?.some(unit => String(unit.id) === item.unitId && unit.product_id === Number(item.productId) && unit.warehouse_id === Number(item.warehouseId) && unit.bin_id === Number(item.locationId) && unit.status === 'available')) {
          setFormError('Select a different available serial or IMEI unit for each serialized item.'); return
        }
        selectedUnits.add(item.unitId)
      }
    }
    const tax = Number(taxPercent)
    if (!Number.isFinite(tax) || tax < 0 || tax > 100) { setFormError('Tax must be between 0 and 100%.'); return }
    createOrder.mutate()
  }

  return <FormPanel title="Create sales order" description="Choose a product, warehouse, then a location within that warehouse for each item. Stock is reserved at those locations when saved.">
    {loadFailed ? <div className="alert alert-error" role="alert">Could not load customers. <Button size="small" onClick={() => void customers.refetch()}>Retry</Button></div> : null}
    {formError || createOrder.isError ? <div className="alert alert-error" role="alert">{formError || getFormError(createOrder.error)}</div> : null}
    <form onSubmit={submit}>
      <div className="order-form-grid">
        <Field label="Customer" optional><select value={customerId} onChange={event => setCustomerId(event.target.value)} disabled={loading}><option value="">Walk-in customer</option>{customers.data?.map(customer => <option key={customer.id} value={customer.id}>{customer.customer_code} — {customer.name}</option>)}</select></Field>
      </div>
      <div className="order-items-heading"><h3>Items</h3><button type="button" className="button page-button" onClick={() => setItems(current => [...current, newItem()])}><Plus /> Add item</button></div>
      <div className="order-items">{items.map(item => <SalesOrderItemRow key={item.key} item={item} disabled={loading} otherUnitIds={items.filter(other => other.key !== item.key && other.unitId).map(other => other.unitId)} onChange={change => updateItem(item.key, change)} onRemove={() => setItems(current => current.filter(row => row.key !== item.key))} canRemove={items.length > 1} />)}</div>
      <div className="order-form-grid">
        <Field label="Tax (%)"><input type="number" min="0" max="100" step="0.01" value={taxPercent} onChange={event => setTaxPercent(event.target.value)} /></Field>
        <Field label="Notes"><textarea rows={2} value={notes} onChange={event => setNotes(event.target.value)} /></Field>
      </div>
      <div className="order-form-footer"><p>Estimated total <strong>{money(estimatedTotal)}</strong><small>Final amount is calculated when saved.</small></p><div><button type="button" className="button page-button" onClick={onCancel}>Cancel</button><button type="submit" className="button compact-button" disabled={loading || loadFailed || createOrder.isPending}>{createOrder.isPending ? 'Creating…' : 'Create order'}</button></div></div>
    </form>
  </FormPanel>
}

function SalesOrderItemRow({ item, disabled, otherUnitIds, onChange, onRemove, canRemove }: {
  item: OrderItem; disabled: boolean; otherUnitIds: string[]; onChange: (change: Partial<OrderItem>) => void; onRemove: () => void; canRemove: boolean
}) {
  const serialized = item.product?.tracking_type === 'serial' || item.product?.tracking_type === 'imei'
  const units = useQuery({ ...availableInventoryUnitQuery(Number(item.productId), Number(item.warehouseId), Number(item.locationId)), enabled: Boolean(serialized && item.productId && item.locationId) })
  const availableUnits = units.data?.filter(unit => !otherUnitIds.includes(String(unit.id))) ?? []
  return <div className={`order-item-row sales-order-item ${serialized ? 'sales-order-item--serialized' : ''}`}>
    <CategoryProductPicker categoryId={item.categoryId} productId={item.productId} disabled={disabled}
      onCategoryChange={categoryId => onChange({ categoryId, productId: '', product: undefined, warehouseId: '', locationId: '', unitId: '', quantity: '1' })}
      onProductChange={product => onChange({ product, productId: product ? String(product.id) : '', warehouseId: '', locationId: '', unitId: '', quantity: '1' })} />
    <WarehousePicker value={item.warehouseId} onChange={warehouseId => onChange({ warehouseId, locationId: '', unitId: '' })} disabled={disabled || !item.productId} required={item.product?.tracking_type !== 'none'} />
    <InventoryLocationPicker warehouseId={Number(item.warehouseId)} productId={Number(item.productId)} locationId={item.locationId} onChange={location => onChange({ locationId: location ? String(location.id) : '', unitId: '' })} disabled={disabled} stockTracked={item.product?.tracking_type !== 'none'} />
    <Field label="Quantity" required><input type="number" min="0.001" step="any" value={item.quantity} onChange={event => onChange({ quantity: event.target.value })} readOnly={serialized} required /></Field>
    {serialized && <div className="product-picker sales-order-unit-picker">
      <Field label="Serial / IMEI" required><select value={item.unitId} onChange={event => onChange({ unitId: event.target.value })} required disabled={disabled || !item.locationId || units.isLoading || units.isError}><option value="">{!item.locationId ? 'Choose a location first' : units.isLoading ? 'Loading units…' : 'Select unit'}</option>{availableUnits.map(unit => <option key={unit.id} value={unit.id}>{unit.serial_number || unit.imei}</option>)}</select></Field>
      {units.isError && <div className="picker-feedback" role="alert">Could not load available units.<Button size="small" onClick={() => void units.refetch()}>Retry</Button></div>}
      {item.locationId && units.isSuccess && availableUnits.length === 0 && <div className="picker-feedback" role="status">No unselected units are available at this location.</div>}
    </div>}
    <Button variant="danger" size="icon" className="remove-item" onClick={onRemove} disabled={!canRemove} aria-label="Remove item"><Trash2 aria-hidden="true" /></Button>
  </div>
}
