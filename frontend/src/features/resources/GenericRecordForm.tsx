import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { apiClient } from '../../services/api-client'
import { getFormError } from '../auth/form-error'
import { catalogLabel, editableFields, type Field as FieldDefinition } from './resource-forms'
import { Button } from '../../components/ui/Button'
import { Field } from '../../components/ui/Field'
import { FormPanel } from '../../components/ui/FormPanel'
import { categoryPath, eligibleParents } from './category-hierarchy'
import { resourceByPath } from './resource-config'

interface Page { data: Array<Record<string, unknown>>; next_cursor?: string | null }

function warrantyDurationMonths(startValue: unknown, endValue: unknown): string {
  if (typeof startValue !== 'string' || typeof endValue !== 'string') return ''
  const start = new Date(`${startValue.slice(0, 10)}T00:00:00`)
  const end = new Date(`${endValue.slice(0, 10)}T00:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return ''

  let months = (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth()
  const targetMonth = start.getMonth() + months
  const targetYear = start.getFullYear() + Math.floor(targetMonth / 12)
  const normalizedMonth = ((targetMonth % 12) + 12) % 12
  const targetDay = Math.min(start.getDate(), new Date(targetYear, normalizedMonth + 1, 0).getDate())
  const expectedEnd = new Date(targetYear, normalizedMonth, targetDay)
  if (expectedEnd > end) months -= 1
  return String(Math.max(1, months))
}

export function GenericRecordForm({ resource, initial, onCancel, onSaved }: {
  resource: string
  initial?: Record<string, unknown>
  onCancel: () => void
  onSaved: () => void
}) {
  const fields = editableFields[resource]
  const title = `${initial ? 'Edit' : 'Create'} ${resourceByPath[resource]?.recordName ?? (resource === 'products' ? 'product' : resource.replaceAll('-', ' '))}`
  const groups = resource === 'products' ? [
    { title: 'Product identity', fields: fields.filter(field => ['sku', 'name', 'category_id', 'brand_id', 'product_type', 'tracking_type'].includes(field.name)) },
    { title: 'Pricing and stock rules', fields: fields.filter(field => ['cost_price', 'selling_price', 'warranty_months', 'reorder_level'].includes(field.name)) },
    { title: 'Details and availability', fields: fields.filter(field => ['description', 'status'].includes(field.name)) },
  ] : [{ title: '', fields }]
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(fields.map(field => {
    const value = resource === 'warranties' && field.name === 'warranty_months' && initial
      ? warrantyDurationMonths(initial.warranty_start, initial.warranty_end)
      : initial?.[field.name] ?? field.defaultValue ?? ''
    return [field.name, String(value)]
  })))
  const sources = [...new Set(fields.flatMap(field => field.source ? [field.source] : []))]
  const catalogs = useQuery({
    queryKey: ['catalog', 'record-form', ...sources],
    queryFn: async () => Object.fromEntries(await Promise.all(sources.map(async source => {
      const rows: Array<Record<string, unknown>> = []
      let cursor: string | null = null
      do {
        const response: Page = (await apiClient.get<Page>(`/api/v1/${source}`, { params: { per_page: 100, cursor: cursor || undefined } })).data
        rows.push(...response.data)
        cursor = ['categories', 'brands', 'warehouses'].includes(source) ? response.next_cursor ?? null : null
      } while (cursor)
      return [source, rows] as const
    }))),
  })
  const client = useQueryClient()
  const save = useMutation({
    mutationFn: async () => {
      const payload = Object.fromEntries(fields.filter(field => !field.generated).map(field => {
        const value = values[field.name]?.trim() ?? ''
        return [field.name, value === '' ? null : field.kind === 'number' || field.source ? Number(value) : value]
      }))
      if (initial) await apiClient.put(`/api/v1/${resource}/${initial.id}`, payload)
      else await apiClient.post(`/api/v1/${resource}`, payload)
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['resource', resource] })
      await client.invalidateQueries({ queryKey: ['catalog'] })
      onSaved()
    },
  })

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    save.mutate()
  }

  function renderField(field: FieldDefinition) {
    const rows = catalogs.data?.[field.source ?? ''] ?? []
    const choices = resource === 'categories' && field.name === 'parent_id' ? eligibleParents(rows, initial?.id) : field.source === 'warehouses' ? rows.filter(row => row.status === 'active' || String(row.id) === values[field.name]) : rows
    return <Field key={field.name} label={field.label} required={field.required} hint={field.generated ? initial ? 'System-assigned code; cannot be changed.' : 'Assigned automatically when saved.' : undefined}>
      {field.generated ? <input type="text" readOnly value={initial ? values[field.name] : ''} placeholder="Auto-generated on save" className="generated-code" />
        : field.kind === 'select' ? <select disabled={resource === 'warehouse-bins' && field.name === 'warehouse_id' && Boolean(initial)} value={values[field.name]} required={field.required} onChange={event => setValues(current => ({ ...current, [field.name]: event.target.value }))}>
        {!field.required && <option value="">None</option>}
        {field.required && !values[field.name] && <option value="">Select {field.label.toLowerCase()}</option>}
        {(field.options ?? choices.map(row => ({ value: String(row.id), label: field.source === 'categories' ? categoryPath(row, rows) : catalogLabel(field.source ?? '', row) }))).map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select> : field.kind === 'textarea' ? <textarea rows={3} value={values[field.name]} required={field.required} onChange={event => setValues(current => ({ ...current, [field.name]: event.target.value }))} />
        : <input type={field.kind ?? 'text'} min={field.kind === 'number' ? (resource === 'warranties' ? 1 : 0) : undefined} step={field.kind === 'number' ? 'any' : undefined} required={field.required} value={values[field.name]} onChange={event => setValues(current => ({ ...current, [field.name]: event.target.value }))} />}
    </Field>
  }

  return <FormPanel title={title} description={resource === 'categories' ? 'Leave the parent empty for a top-level category. Inactive categories are hidden from sales category choices; existing products are retained.' : resource === 'products' ? 'Required fields are marked with an asterisk. Prices are in MYR.' : resource === 'warranties' ? initial ? 'Enter the coverage period in months. The original start date is retained and the end date is recalculated.' : 'Enter the coverage period in months. The warranty starts today and the end date is calculated automatically.' : undefined}>
    {catalogs.isError && <div className="alert alert-error" role="alert">Could not load the choices for this form.</div>}
    {save.isError && <div className="alert alert-error" role="alert">{getFormError(save.error)}</div>}
    <form onSubmit={submit}>
      {groups.map(group => <div className={group.title ? 'form-section' : undefined} key={group.title}>{group.title && <h3>{group.title}</h3>}<div className="order-form-grid">{group.fields.filter(field => initial || !field.generated).map(renderField)}</div></div>)}
      <div className="order-form-footer"><span /><div><Button onClick={onCancel}>Cancel</Button><Button variant="primary" type="submit" disabled={save.isPending || catalogs.isLoading || catalogs.isError}>{save.isPending ? 'Saving…' : resource === 'products' ? initial ? 'Save changes' : 'Create product' : 'Save record'}</Button></div></div>
    </form>
  </FormPanel>
}
