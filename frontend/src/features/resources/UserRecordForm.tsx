import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Button } from '../../components/ui/Button'
import { Field } from '../../components/ui/Field'
import { FormPanel } from '../../components/ui/FormPanel'
import { apiClient } from '../../services/api-client'
import { getFormError } from '../auth/form-error'
import { currentUserQueryKey } from '../auth/session-cache'

export function UserRecordForm({ initial, currentUserId, onCancel, onSaved }: {
  initial?: Record<string, unknown>
  currentUserId?: number
  onCancel: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(String(initial?.name ?? ''))
  const [email, setEmail] = useState(String(initial?.email ?? ''))
  const [role, setRole] = useState(String(initial?.role ?? 'staff'))
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const client = useQueryClient()
  const ownAccount = initial?.id === currentUserId
  const save = useMutation({
    mutationFn: async () => {
      const payload = { name: name.trim(), email: email.trim().toLowerCase(), role, ...(!initial || password ? { password, password_confirmation: confirmation } : {}) }
      if (initial) await apiClient.put(`/api/v1/users/${initial.id}`, payload)
      else await apiClient.post('/api/v1/users', payload)
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['resource', 'users'] })
      if (ownAccount) await client.invalidateQueries({ queryKey: currentUserQueryKey })
      onSaved()
    },
  })
  const submit = (event: FormEvent) => { event.preventDefault(); save.mutate() }
  return <FormPanel title={initial ? 'Edit user' : 'Create user'} description="Admin can manage users and delete records. Staff can perform operational work but cannot delete records or manage users.">
    {save.isError && <div className="alert alert-error" role="alert">{getFormError(save.error)}</div>}
    <form onSubmit={submit}>
      <div className="order-form-grid">
        <Field label="Name" required><input required maxLength={255} value={name} onChange={event => setName(event.target.value)} autoComplete="name" /></Field>
        <Field label="Email" required><input type="email" required maxLength={255} value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" /></Field>
        <Field label="Role" required hint={ownAccount ? 'You cannot remove your own admin access.' : initial ? 'Existing job-specific roles are retained unless you change Admin/Staff.' : undefined}><select required disabled={ownAccount} value={role} onChange={event => setRole(event.target.value)}><option value="staff">Staff</option><option value="admin">Admin</option></select></Field>
        <Field label="Password" required={!initial} optional={Boolean(initial)} hint={initial ? 'Leave blank to keep the current password. Changing it signs this user out.' : 'At least 12 characters.'}><input type="password" required={!initial} minLength={12} value={password} onChange={event => setPassword(event.target.value)} autoComplete="new-password" /></Field>
        <Field label="Confirm password" required={!initial || Boolean(password)}><input type="password" required={!initial || Boolean(password)} minLength={12} value={confirmation} onChange={event => setConfirmation(event.target.value)} autoComplete="new-password" /></Field>
      </div>
      <div className="order-form-footer"><span /><div><Button onClick={onCancel}>Cancel</Button><Button type="submit" variant="primary" disabled={save.isPending}>{save.isPending ? 'Saving…' : initial ? 'Save changes' : 'Create user'}</Button></div></div>
    </form>
  </FormPanel>
}
