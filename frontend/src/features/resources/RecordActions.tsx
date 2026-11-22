import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Printer } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { apiClient } from '../../services/api-client'
import { getFormError } from '../auth/form-error'
import { useCurrentUser } from '../auth/use-current-user'
import { WarehousePicker } from './WarehousePicker'
import { InventoryLocationPicker } from './InventoryLocationPicker'
import { availableInventoryUnitQuery } from './inventory-location-queries'
import { Choice, useCatalog } from './workflow-utils'
import { FormPanel } from '../../components/ui/FormPanel'
import { Button } from '../../components/ui/Button'
import { Field } from '../../components/ui/Field'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { PcBuildCompatibility } from './PcBuildCompatibility'
import { DataTable } from '../../components/ui/DataTable'
import { PcBuildConvertForm } from './PcBuildConvertForm'
import { GoodsReceiptForm } from './GoodsReceiptForm'

interface InvoiceLine { id: number; quantity: string; unit_price: string; line_total: string; product?: { sku: string; name: string } | null }
interface InvoiceOrder { number: string; subtotal: string; tax: string; total: string; customer?: { name: string; customer_code: string; email?: string | null; phone?: string | null; address?: string | null } | null; items: InvoiceLine[] }
interface Detail { id: number; number: string; status: string; total?: string; issued_at?: string; due_at?: string | null; sales_order_id?: number | null; sales_order?: InvoiceOrder; warehouse_id?: number | null; items?: Array<{ id: number; product_id: number; warehouse_id?: number | null; bin_id?: number | null; quantity?: string | number; ordered_quantity?: string; received_quantity?: string; warehouse?: { code: string; name: string } | null; location?: { code: string; name: string } | null; product?: { sku: string; name: string } }> }
const transitions: Record<string, string[]> = {
  received: ['diagnosing', 'cancelled'], diagnosing: ['awaiting_approval', 'cancelled'],
  awaiting_approval: ['awaiting_parts', 'repairing', 'cancelled'], awaiting_parts: ['repairing', 'cancelled'],
  repairing: ['testing', 'cancelled'], testing: ['ready_for_collection', 'repairing'], ready_for_collection: ['completed'],
}
const formatMoney = (amount: string | number | undefined) => new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(Number(amount ?? 0))
function formatInvoiceDate(value?: string) {
  if (!value) return '—'
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-MY', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'UTC' }).format(date)
}

export function RecordActions({ resource, row, onClose }: { resource: string; row: Record<string, unknown>; onClose: () => void }) {
  const id = Number(row.id)
  const client = useQueryClient()
  const { data: user } = useCurrentUser()
  const can = (permission: string) => Boolean(user?.permissions?.includes(permission) || user?.roles?.includes('super-admin'))
  const detail = useQuery({ queryKey: ['detail', resource, id], queryFn: async () => (await apiClient.get<{ data: Detail }>(`/api/v1/${resource}/${id}`)).data.data })
  const products = useCatalog('products', resource === 'repairs' || resource === 'purchase-orders')
  const [method, setMethod] = useState('cash')
  const [reference, setReference] = useState('')
  const [status, setStatus] = useState('')
  const [notes, setNotes] = useState('')
  const [productId, setProductId] = useState('')
  const [warehouseId, setWarehouseId] = useState('')
  const [locationId, setLocationId] = useState('')
  const [unitId, setUnitId] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [workflowSuccess, setWorkflowSuccess] = useState('')

  const action = useMutation({
    mutationFn: async (kind: string) => {
      if (kind === 'complete') return apiClient.post(`/api/v1/sales-orders/${id}/complete`, { method, reference: reference || null })
      if (kind === 'approve') return apiClient.post(`/api/v1/purchase-orders/${id}/approve`)
      if (kind === 'status') return apiClient.post(`/api/v1/repairs/${id}/status`, { status, notes: notes || null })
      if (kind === 'part') return apiClient.post(`/api/v1/repairs/${id}/parts`, { product_id: Number(productId), warehouse_id: Number(warehouseId), bin_id: Number(locationId), inventory_unit_id: unitId ? Number(unitId) : null, quantity: Number(quantity) })
      if (kind === 'duplicate-build') return apiClient.post(`/api/v1/pc-builds/${id}/duplicate`)
      if (kind === 'accept-build') return apiClient.post(`/api/v1/pc-builds/${id}/accept`)
      throw new Error('Unsupported workflow action.')
    },
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ['detail', resource, id] }),
        client.invalidateQueries({ queryKey: ['resource', resource] }),
        client.invalidateQueries({ queryKey: ['resource', 'inventory'] }),
        client.invalidateQueries({ queryKey: ['resource', 'invoices'] }),
        client.invalidateQueries({ queryKey: ['resource', 'goods-receipts'] }),
        client.invalidateQueries({ queryKey: ['dashboard'] }),
        client.invalidateQueries({ queryKey: ['reports'] }),
        client.invalidateQueries({ queryKey: ['catalog', 'inventory-locations'] }),
        client.invalidateQueries({ queryKey: ['catalog', 'available-inventory-units'] }),
      ])
      setLocationId(''); setUnitId(''); setStatus(''); setNotes('')
    },
  })
  const current = detail.data
  if (resource === 'invoices') return <FormPanel title="Invoice">
    {detail.isLoading && <div className="table-state">Loading invoice…</div>}
    {detail.isError && <div className="alert alert-error" role="alert">Could not load the invoice details.</div>}
    {current?.sales_order && <article className="invoice-document">
      <header className="invoice-document-header"><div><div className="invoice-brand">TechOps</div><p>Sales invoice</p></div><div className="invoice-number"><span>Invoice</span><strong>{current.number}</strong><StatusBadge status={current.status} /></div></header>
      <div className="invoice-parties"><section><h3>Bill to</h3><strong>{current.sales_order.customer?.name ?? 'Walk-in customer'}</strong>{current.sales_order.customer?.customer_code && <span>{current.sales_order.customer.customer_code}</span>}{current.sales_order.customer?.address && <span>{current.sales_order.customer.address}</span>}{current.sales_order.customer?.email && <span>{current.sales_order.customer.email}</span>}{current.sales_order.customer?.phone && <span>{current.sales_order.customer.phone}</span>}</section><section><h3>Invoice details</h3><span>Issued: {formatInvoiceDate(current.issued_at)}</span>{current.due_at && <span>Due: {formatInvoiceDate(current.due_at)}</span>}<span>Sales order: {current.sales_order.number}</span></section></div>
      <table className="invoice-lines"><thead><tr><th>Item</th><th>Qty</th><th>Unit price</th><th>Amount</th></tr></thead><tbody>{current.sales_order.items.map(line => <tr key={line.id}><td>{line.product ? <><strong>{line.product.name}</strong><small>{line.product.sku}</small></> : 'Item'}</td><td>{Number(line.quantity).toLocaleString('en-MY', { maximumFractionDigits: 3 })}</td><td>{formatMoney(line.unit_price)}</td><td>{formatMoney(line.line_total)}</td></tr>)}</tbody></table>
      <dl className="invoice-totals"><div><dt>Subtotal</dt><dd>{formatMoney(current.sales_order.subtotal)}</dd></div><div><dt>Tax</dt><dd>{formatMoney(current.sales_order.tax)}</dd></div><div className="invoice-grand-total"><dt>Total</dt><dd>{formatMoney(current.total ?? current.sales_order.total)}</dd></div></dl>
      <footer className="invoice-thanks">Thank you for your business.</footer>
    </article>}
    {detail.isSuccess && !current?.sales_order && <div className="alert alert-error" role="alert">Invoice details are unavailable for printing.</div>}
    <div className="order-form-footer invoice-print-actions"><span /><div><Button onClick={onClose}>Close</Button><Button variant="primary" onClick={() => window.print()} disabled={!current?.sales_order}><Printer aria-hidden="true" />Print invoice</Button></div></div>
  </FormPanel>
  const product = products.data?.find(row => String(row.id) === productId)
  const serialized = product?.tracking_type === 'serial' || product?.tracking_type === 'imei'
  const units = useQuery({ ...availableInventoryUnitQuery(Number(productId), Number(warehouseId), Number(locationId)), enabled: Boolean(resource === 'repairs' && serialized && productId && warehouseId && locationId) })
  const availableUnits = units.data ?? []
  function submit(event: FormEvent<HTMLFormElement>, kind: string) { event.preventDefault(); action.mutate(kind) }

  return <FormPanel title={String(row.number || `#${id}`)} description={`Current status: ${current?.status?.replaceAll('_', ' ') || 'Loading…'}`}>
    {detail.isError && <div className="alert alert-error" role="alert">Could not load record details.</div>}
    {action.isError && <div className="alert alert-error" role="alert">{getFormError(action.error)}</div>}
    {action.isSuccess && <div className="alert alert-success" role="status">Action completed.</div>}
    {workflowSuccess && <div className="alert alert-success" role="status">{workflowSuccess}</div>}
    {resource === 'sales-orders' && current?.items && <div className="table-panel">
      <DataTable label="Order items and inventory locations" columns={[{ key: 'product', label: 'Product' }, { key: 'warehouse', label: 'Warehouse' }, { key: 'location', label: 'Location' }, { key: 'quantity', label: 'Quantity', align: 'center' }]} rows={current.items.map(item => ({ id: item.id, product: item.product ? `${item.product.sku} — ${item.product.name}` : `Product #${item.product_id}`, warehouse: item.warehouse ? `${item.warehouse.code} — ${item.warehouse.name}` : item.warehouse_id || current.warehouse_id ? `Warehouse #${item.warehouse_id ?? current.warehouse_id}` : 'Not required', location: item.location ? `${item.location.code} — ${item.location.name}` : item.bin_id ? `Location #${item.bin_id}` : 'Not required', quantity: Number(item.quantity) }))} renderCell={(item, column) => String(item[column.key])} />
      <div className="table-footnote">Stock is reserved and fulfilled at each item's selected location.</div>
    </div>}
    {resource === 'sales-orders' && current && ['confirmed', 'processing'].includes(current.status) && can('sales.approve') && <form className="action-form" onSubmit={event => submit(event, 'complete')}><h3>Complete sale</h3><p>Payment will be recorded and an invoice issued for {current.total}.</p><div className="order-form-grid"><Field label="Payment method" required><select value={method} onChange={event => setMethod(event.target.value)} required>{['cash', 'card', 'bank_transfer', 'e_wallet'].map(value => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}</select></Field><Field label="Reference"><input value={reference} onChange={event => setReference(event.target.value)} /></Field></div><button className="button compact-button" type="submit" disabled={action.isPending}>Complete sale</button></form>}
    {resource === 'purchase-orders' && current?.status === 'pending_approval' && can('purchases.approve') && <div className="action-form"><h3>Approval</h3><button className="button compact-button" type="button" onClick={() => action.mutate('approve')} disabled={action.isPending}>Approve purchase order</button></div>}
    {resource === 'purchase-orders' && current && ['approved', 'ordered', 'partially_received'].includes(current.status) && <GoodsReceiptForm key={current.items?.map(item => `${item.id}:${item.received_quantity ?? 0}`).join(',')} order={{ id, warehouse_id: Number(current.warehouse_id), items: current.items ?? [] }} onSaved={() => { setWorkflowSuccess('Goods receipt saved. Stock balances updated.'); void client.invalidateQueries({ queryKey: ['detail', resource, id] }) }} />}
    {resource === 'repairs' && current && transitions[current.status]?.length > 0 && <form className="action-form" onSubmit={event => submit(event, 'status')}><h3>Update repair status</h3><div className="order-form-grid"><Field label="Next status" required><select value={status} onChange={event => setStatus(event.target.value)} required><option value="">Select status</option>{transitions[current.status].map(value => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}</select></Field><Field label="Notes"><textarea rows={2} value={notes} onChange={event => setNotes(event.target.value)} /></Field></div><button className="button compact-button" type="submit" disabled={action.isPending || !status}>Update status</button></form>}
    {resource === 'repairs' && current && !['completed', 'cancelled'].includes(current.status) && <form className="action-form" onSubmit={event => submit(event, 'part')}><h3>Use repair part</h3><div className="order-form-grid"><Choice label="Product" value={productId} onChange={value => { setProductId(value); setWarehouseId(''); setLocationId(''); setUnitId(''); setQuantity('1') }} rows={(products.data ?? []).filter(row => row.status === 'active' && row.tracking_type !== 'none')} required /><WarehousePicker value={warehouseId} onChange={value => { setWarehouseId(value); setLocationId(''); setUnitId('') }} disabled={!productId} /><InventoryLocationPicker productId={Number(productId)} warehouseId={Number(warehouseId)} locationId={locationId} onChange={location => { setLocationId(location ? String(location.id) : ''); setUnitId('') }} /><Field label="Quantity" required><input type="number" min="0.001" step="any" value={quantity} onChange={event => setQuantity(event.target.value)} readOnly={serialized} required /></Field>{serialized && <Choice label="Serial / IMEI" value={unitId} onChange={setUnitId} rows={availableUnits} required />}</div><button className="button compact-button" type="submit" disabled={action.isPending || !productId || !warehouseId || !locationId || (serialized && (!unitId || Number(quantity) !== 1))}>Use part</button></form>}
    {resource === 'pc-builds' && current && <PcBuildCompatibility buildId={id} />}
    {resource === 'pc-builds' && current && current.items && can('sales.create') && <>
      {current.status === 'draft' && <div className="action-form"><h3>Build template and acceptance</h3><p>Accepting runs the compatibility check again. Builds with incompatible parts cannot be accepted.</p><div className="resource-actions"><Button onClick={() => action.mutate('duplicate-build')} disabled={action.isPending}>Duplicate as template</Button><Button variant="primary" onClick={() => action.mutate('accept-build')} disabled={action.isPending || current.items.length === 0}>Accept build</Button></div></div>}
      {current.status === 'accepted' && <PcBuildConvertForm buildId={id} items={current.items} onSaved={() => { void client.invalidateQueries({ queryKey: ['detail', resource, id] }) }} />}
    </>}
    <div className="order-form-footer"><span /><Button onClick={onClose} disabled={action.isPending}>Close</Button></div>
  </FormPanel>
}
