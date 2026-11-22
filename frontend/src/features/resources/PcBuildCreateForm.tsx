import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { apiClient } from '../../services/api-client'
import { getFormError } from '../auth/form-error'
import { Choice, optionLabel, useCatalog } from './workflow-utils'
import { FormPanel } from '../../components/ui/FormPanel'
import { Field } from '../../components/ui/Field'
import { Button } from '../../components/ui/Button'
import { PcBuildCompatibility } from './PcBuildCompatibility'
import { editablePcBuild } from './pc-build-utils'

const componentTypes = ['cpu', 'motherboard', 'ram', 'gpu', 'ssd', 'psu', 'case', 'cooler', 'other']
interface Line { key: string; productId: string; componentType: string; quantity: string }
const newLine = (): Line => ({ key: crypto.randomUUID(), productId: '', componentType: '', quantity: '1' })
interface BuildRecord extends Record<string, unknown> {
  id: number; customer_id?: number | null; budget?: string | number | null; notes?: string | null
  items: Array<{ id: number; product_id: number; component_type: string; quantity: string | number }>
}

export function PcBuildEditForm({ id, onCancel, onSaved }: { id: number; onCancel: () => void; onSaved: () => void }) {
  const detail = useQuery({ queryKey: ['detail', 'pc-builds', id], queryFn: async () => (await apiClient.get<{ data: BuildRecord }>(`/api/v1/pc-builds/${id}`)).data.data })
  if (detail.isLoading) return <div className="table-state">Loading build…</div>
  if (detail.isError || !detail.data) return <div className="alert alert-error" role="alert">Could not load this build. <Button onClick={() => void detail.refetch()}>Retry</Button></div>
  if (!editablePcBuild(detail.data)) return <><div className="alert alert-warning">Only unlinked draft builds with no reserved components can be edited or deleted.</div><PcBuildCompatibility buildId={id} /></>
  return <PcBuildCreateForm key={id} initial={detail.data} onCancel={onCancel} onSaved={onSaved} />
}

export function PcBuildCreateForm({ initial, onCancel, onSaved }: { initial?: BuildRecord; onCancel: () => void; onSaved: () => void }) {
  const customers = useCatalog('customers')
  const products = useCatalog('products')
  const categories = useCatalog('categories')
  const client = useQueryClient()
  const [customerId, setCustomerId] = useState(initial?.customer_id ? String(initial.customer_id) : '')
  const [budget, setBudget] = useState(initial?.budget != null ? String(initial.budget) : '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [lines, setLines] = useState<Line[]>(() => initial?.items.length ? initial.items.map(item => ({ key: String(item.id), productId: String(item.product_id), componentType: item.component_type, quantity: String(item.quantity) })) : [newLine()])
  const [error, setError] = useState('')
  const update = (key: string, change: Partial<Line>) => setLines(current => current.map(line => line.key === key ? { ...line, ...change } : line))
  const save = useMutation({
    mutationFn: async () => {
      const payload = { customer_id: customerId ? Number(customerId) : null, budget: budget ? Number(budget) : null, notes: notes || null, items: lines.map(line => ({ product_id: Number(line.productId), component_type: line.componentType, quantity: Number(line.quantity) })) }
      return initial ? apiClient.put(`/api/v1/pc-builds/${initial.id}`, payload) : apiClient.post('/api/v1/pc-builds', payload)
    },
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ['resource', 'pc-builds'] }); await client.invalidateQueries({ queryKey: ['detail', 'pc-builds'] }); onSaved() },
  })
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const types = lines.map(line => line.componentType)
    if (lines.length === 0 || lines.some(line => !line.productId || !line.componentType || Number(line.quantity) <= 0) || new Set(types).size !== types.length) { setError('Choose a product and a unique component type for each line.'); return }
    setError(''); save.mutate()
  }
  const customerOptions = customers.data ?? []
  const selectableCustomers = customerId && !customerOptions.some(row => String(row.id) === customerId) ? [{ id: Number(customerId), name: `Customer #${customerId}` }, ...customerOptions] : customerOptions
  return <FormPanel title={initial ? 'Edit PC build' : 'Create PC build'}>
    {(customers.isError || products.isError || categories.isError) && <div className="alert alert-error" role="alert">Could not load customers, categories or the component catalog. <Button onClick={() => { void customers.refetch(); void products.refetch(); void categories.refetch() }}>Retry</Button></div>}
    {(error || save.isError) && <div className="alert alert-error" role="alert">{error || getFormError(save.error)}</div>}
    <form onSubmit={submit}><div className="order-form-grid">
      <Choice label="Customer" value={customerId} onChange={setCustomerId} rows={selectableCustomers} />
      <Field label="Budget"><input type="number" min="0" step="0.01" value={budget} onChange={event => setBudget(event.target.value)} /></Field>
      <Field label="Requirements / notes"><textarea rows={2} value={notes} onChange={event => setNotes(event.target.value)} /></Field>
    </div><div className="order-items-heading"><h3>Components</h3><button className="button page-button" type="button" onClick={() => setLines(current => [...current, newLine()])}><Plus /> Add component</button></div>
      <div className="order-items">{lines.map(line => <div className="order-item-row purchase-line" key={line.key}>
        <Field label="Component type" required><select value={line.componentType} onChange={event => update(line.key, { componentType: event.target.value, productId: '' })} required><option value="">Select type</option>{line.componentType && !componentTypes.includes(line.componentType) && <option value={line.componentType}>{line.componentType}</option>}{componentTypes.map(type => <option key={type} value={type}>{type.toUpperCase()}</option>)}</select></Field>
        <Field label="Product" required><select value={line.productId} onChange={event => update(line.key, { productId: event.target.value })} required><option value="">Select product</option>{line.productId && !products.data?.some(row => String(row.id) === line.productId) && <option value={line.productId}>Product #{line.productId} (current)</option>}{filterBuildProducts(products.data ?? [], categories.data ?? [], line.componentType).filter(row => String(row.id) === line.productId || (row.status === 'active' && row.tracking_type !== 'none')).map(row => <option key={row.id} value={row.id}>{optionLabel(row)}</option>)}</select></Field>
        <Field label="Quantity" required><input type="number" min="0.001" step="any" value={line.quantity} onChange={event => update(line.key, { quantity: event.target.value })} required /></Field>
        <button className="icon-button remove-item" type="button" onClick={() => setLines(current => current.filter(item => item.key !== line.key))} disabled={lines.length === 1} aria-label="Remove component"><Trash2 /></button>
      </div>)}</div>
      <div className="order-form-footer"><span /><div><button className="button page-button" type="button" onClick={onCancel}>Cancel</button><button className="button compact-button" type="submit" disabled={save.isPending || customers.isLoading || products.isLoading || customers.isError || products.isError}>{save.isPending ? 'Saving…' : initial ? 'Save changes' : 'Create build'}</button></div></div>
    </form>
    {initial && <PcBuildCompatibility buildId={initial.id} showSaveHint />}
  </FormPanel>
}

function filterBuildProducts(products: Array<{ id: number; category_id?: number | null; status?: string; tracking_type?: string }>, categories: Array<{ id: number; name?: string; parent_id?: number | null }>, type: string) {
  const terms: Record<string, string[]> = { cpu: ['cpu', 'processor'], motherboard: ['motherboard', 'mainboard'], ram: ['ram', 'memory'], gpu: ['gpu', 'graphics'], ssd: ['ssd', 'storage'], psu: ['psu', 'power supply'], case: ['case', 'chassis'], cooler: ['cooler', 'cooling'] }
  const aliases = terms[type]
  if (!aliases) return products
  const categoryById = new Map(categories.map(category => [category.id, category]))
  const matching = new Set(categories.filter(category => {
    const names = [category.name ?? '']
    let parent = categoryById.get(Number(category.parent_id))
    const visited = new Set([category.id])
    while (parent && !visited.has(parent.id)) { names.push(parent.name ?? ''); visited.add(parent.id); parent = categoryById.get(Number(parent.parent_id)) }
    const label = names.join(' ').toLocaleLowerCase()
    return aliases.some(alias => label.includes(alias))
  }).map(category => category.id))
  if (!matching.size) return products
  const descendants = new Set(matching)
  let changed = true
  while (changed) { changed = false; for (const category of categories) if (category.parent_id && descendants.has(category.parent_id) && !descendants.has(category.id)) { descendants.add(category.id); changed = true } }
  return products.filter(product => product.category_id != null && descendants.has(product.category_id))
}
