import { useMutation } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { useState } from 'react'
import { ShieldCheck, UserRound } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Field } from '../../components/ui/Field'
import { FormPanel } from '../../components/ui/FormPanel'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { Modal } from '../../components/ui/Modal'
import { changePassword } from './auth-api'
import { getFormError } from './form-error'
import { useCurrentUser } from './use-current-user'

const schema = z.object({ current_password: z.string().min(1, 'Enter your current password.'), password: z.string().min(12, 'Use at least 12 characters.'), password_confirmation: z.string() })
  .refine(values => values.password === values.password_confirmation, { message: 'Passwords do not match.', path: ['password_confirmation'] })
type Values = z.infer<typeof schema>

export function AccountPage() {
  const { data: user } = useCurrentUser()
  const [editing, setEditing] = useState(false)
  const { register, handleSubmit, reset, formState: { errors } } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { current_password: '', password: '', password_confirmation: '' } })
  const mutation = useMutation({ mutationFn: changePassword, onSuccess: () => { reset(); setEditing(false) } })
  const dismiss = () => { if (!mutation.isPending) { setEditing(false); reset(); mutation.reset() } }
  return <main className="dashboard">
    <PageHeader title="My account" section="Account" description="Your staff identity and sign-in security." />
    <div className="account-workspace">
      <section className="account-panel" aria-label="Staff profile">
        <header className="account-panel-heading"><UserRound aria-hidden="true" /><div><h2>Staff profile</h2><p>Your identity and assigned access.</p></div></header>
        <dl className="account-profile"><div><dt>Name</dt><dd>{user?.name}</dd></div><div><dt>Email</dt><dd>{user?.email}</dd></div><div><dt>Assigned roles</dt><dd>{user?.roles.map(role => <StatusBadge key={role} status={role.replaceAll('-', ' ')} tone="neutral" />)}</dd></div></dl>
        <footer className="account-panel-note">Contact your administrator to change your profile or access.</footer>
      </section>
      <section className="account-panel" aria-label="Sign-in security">
        <header className="account-panel-heading"><ShieldCheck aria-hidden="true" /><div><h2>Sign-in security</h2><p>Keep your account credentials secure.</p></div></header>
        <div className="account-security-content"><div><h3>Password</h3><p>Use a unique password with at least 12 characters. Changing it ends other established sessions.</p></div><Button onClick={() => { mutation.reset(); setEditing(true) }}>Change password</Button></div>
        {mutation.isSuccess && <div className="alert alert-success" role="status">{mutation.data}</div>}
        <footer className="account-panel-note">Your current session remains signed in after a password change.</footer>
      </section>
    </div>
    {editing && <Modal title="Change password" busy={mutation.isPending} onClose={dismiss}>
      <FormPanel title="Change password" description="Use at least 12 characters. Other established sessions will need to sign in again.">
        {mutation.isError && <div className="alert alert-error" role="alert">{getFormError(mutation.error)}</div>}
        <form onSubmit={handleSubmit(values => mutation.mutate(values))} noValidate>
          <div className="account-fields"><Field label="Current password" required><input type="password" required autoComplete="current-password" {...register('current_password')} />{errors.current_password && <small className="error-text">{errors.current_password.message}</small>}</Field>
            <Field label="New password" required><input type="password" required autoComplete="new-password" {...register('password')} />{errors.password && <small className="error-text">{errors.password.message}</small>}</Field>
            <Field label="Confirm new password" required><input type="password" required autoComplete="new-password" {...register('password_confirmation')} />{errors.password_confirmation && <small className="error-text">{errors.password_confirmation.message}</small>}</Field></div>
          <div className="order-form-footer"><span /><div><Button onClick={dismiss} disabled={mutation.isPending}>Cancel</Button><Button type="submit" variant="primary" disabled={mutation.isPending}>{mutation.isPending ? 'Updating…' : 'Update password'}</Button></div></div>
        </form>
      </FormPanel>
    </Modal>}
  </main>
}
