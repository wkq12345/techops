import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { apiClient } from '../../services/api-client'
import { getFormError } from '../auth/form-error'
import { Choice, useCatalog } from './workflow-utils'
import { FormPanel } from '../../components/ui/FormPanel'
import { Field } from '../../components/ui/Field'

export function RepairCreateForm({ onCancel, onSaved }: { onCancel: () => void; onSaved: () => void }) {
  const customers = useCatalog('customers')
  const client = useQueryClient()
  const [customerId, setCustomerId] = useState('')
  const [deviceType, setDeviceType] = useState('')
  const [brand, setBrand] = useState('')
  const [model, setModel] = useState('')
  const [serial, setSerial] = useState('')
  const [problem, setProblem] = useState('')
  const [accessories, setAccessories] = useState('')
  const [condition, setCondition] = useState('')
  const [estimate, setEstimate] = useState('')
  const [lookupResult, setLookupResult] = useState<{ repair_history: Array<{ number: string; status: string; customer?: { id: number; name: string } | null }>; warranties: Array<{ number: string; warranty_end: string; status: string }> } | null>(null)
  const lookup = useMutation({
    mutationFn: async () => (await apiClient.get<{ data: typeof lookupResult }>('/api/v1/repairs/intake-lookup', { params: { serial } })).data.data,
    onSuccess: result => { setLookupResult(result); if (!customerId && result?.repair_history[0]?.customer) { const match = customers.data?.find(row => row.id === result.repair_history[0].customer?.id); if (match) setCustomerId(String(match.id)) } },
  })
  const save = useMutation({
    mutationFn: async () => apiClient.post('/api/v1/repairs', { customer_id: Number(customerId), estimated_cost: estimate ? Number(estimate) : null, device: { device_type: deviceType, brand: brand || null, model: model || null, serial_number: serial || null, reported_problem: problem, accessories_received: accessories || null, physical_condition: condition || null } }),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ['resource', 'repairs'] }); onSaved() },
  })
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); save.mutate() }
  return <FormPanel title="Open repair job">
    {customers.isError && <div className="alert alert-error">Could not load customers.</div>}{save.isError && <div className="alert alert-error" role="alert">{getFormError(save.error)}</div>}
    <form onSubmit={submit}><div className="order-form-grid">
      <Choice label="Customer" value={customerId} onChange={setCustomerId} rows={customers.data ?? []} required />
      <Field label="Device type" required><input value={deviceType} onChange={event => setDeviceType(event.target.value)} placeholder="Laptop, phone, desktop…" required /></Field>
      <Field label="Brand"><input value={brand} onChange={event => setBrand(event.target.value)} /></Field>
      <Field label="Model"><input value={model} onChange={event => setModel(event.target.value)} /></Field>
      <Field label="Serial number"><div className="input-with-action"><input value={serial} onChange={event => { setSerial(event.target.value); setLookupResult(null) }} onKeyDown={event => { if (event.key === 'Enter' && serial.trim()) { event.preventDefault(); lookup.mutate() } }} /><button type="button" className="button page-button" onClick={() => lookup.mutate()} disabled={!serial.trim() || lookup.isPending}>{lookup.isPending ? 'Checking…' : 'Check history'}</button></div></Field>
      {lookup.isError && <div className="alert alert-error" role="alert">Could not look up this device history.</div>}
      {lookupResult && <div className="alert alert-info" role="status">{lookupResult.repair_history.length ? `Previous repairs: ${lookupResult.repair_history.map(job => `${job.number} (${job.status.replaceAll('_', ' ')})`).join(', ')}.` : 'No previous repair found for this serial.'}{lookupResult.warranties.length ? ` Warranty: ${lookupResult.warranties.map(warranty => `${warranty.number}, ${warranty.status} until ${warranty.warranty_end}`).join('; ')}.` : ''}</div>}
      <Field label="Estimated cost"><input type="number" min="0" step="0.01" value={estimate} onChange={event => setEstimate(event.target.value)} /></Field>
      <Field label="Reported problem" required><textarea value={problem} onChange={event => setProblem(event.target.value)} required rows={3} /></Field>
      <Field label="Accessories received"><textarea value={accessories} onChange={event => setAccessories(event.target.value)} rows={3} /></Field>
      <Field label="Physical condition"><textarea value={condition} onChange={event => setCondition(event.target.value)} rows={3} /></Field>
    </div><div className="order-form-footer"><span /><div><button className="button page-button" type="button" onClick={onCancel}>Cancel</button><button className="button compact-button" type="submit" disabled={save.isPending || customers.isLoading || customers.isError}>{save.isPending ? 'Saving…' : 'Open repair'}</button></div></div></form>
  </FormPanel>
}
