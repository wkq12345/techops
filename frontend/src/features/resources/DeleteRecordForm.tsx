import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '../../components/ui/Button'
import { Trash2 } from 'lucide-react'
import { editablePcBuild } from './pc-build-utils'
import { apiClient } from '../../services/api-client'
import { getFormError } from '../auth/form-error'

export function DeleteRecordForm({ resource, recordLabel, record, onCancel, onDeleted }: {
  resource: string
  recordLabel: string
  record: Record<string, unknown>
  onCancel: () => void
  onDeleted: () => void
}) {
  const client = useQueryClient()
  const remove = useMutation({
    mutationFn: () => apiClient.delete(`/api/v1/${resource}/${record.id}`),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['resource', resource] })
      await client.invalidateQueries({ queryKey: ['catalog'] })
      onDeleted()
    },
  })
  const occupied = Boolean(record.is_unassigned) || Number(record.stocks_count) > 0 || Number(record.products_count) > 0 || Number(record.children_count) > 0 || (resource === 'pc-builds' && !editablePcBuild(record))
  const linked = resource === 'categories' ? 'products or subcategories' : 'products'
  const label = String(record.name ?? record.company_name ?? record.number ?? `#${record.id}`)
  return <form onSubmit={event => { event.preventDefault(); if (!occupied) remove.mutate() }}>
    <p>Delete “{label}”? {resource === 'users' ? 'Their access will be removed immediately.' : 'This cannot be undone.'}</p>
    <p>{resource === 'users' ? 'Business records and audit history will be retained. You cannot delete your own account or remove the last administrator.' : resource === 'pc-builds' ? 'Only unlinked draft builds with no reserved components can be deleted. The build and its components will be removed; an audit snapshot is retained.' : resource === 'sales-orders' ? 'Only uncompleted orders without invoices or returns can be deleted. Any stock reserved for the order will be released; an audit snapshot is retained.' : resource === 'warranties' ? 'Warranties with claims cannot be deleted. An audit snapshot is retained.' : ['brands', 'categories'].includes(resource) ? occupied ? `This ${recordLabel} contains ${linked}. Reassign them first, or edit the ${recordLabel} and mark it inactive.` : `Only unused records can be deleted. Linked ${linked} will never be removed by this action.` : 'Records linked to stock or business history cannot be deleted. Update their details instead.'}</p>
    {remove.isError && <div className="alert alert-error" role="alert">{getFormError(remove.error)}</div>}
    <div className="order-form-footer"><span /><div><Button onClick={onCancel}>Cancel</Button><Button variant="danger" type="submit" disabled={occupied || remove.isPending}><Trash2 aria-hidden="true" />{remove.isPending ? 'Deleting…' : `Delete ${recordLabel}`}</Button></div></div>
  </form>
}
