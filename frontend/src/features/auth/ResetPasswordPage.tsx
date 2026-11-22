import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { LockKeyhole } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Link, useSearchParams } from 'react-router-dom'
import { z } from 'zod'
import { resetPassword } from './auth-api'
import { getFormError } from './form-error'
import { FieldLabel } from '../../components/ui/Field'

const schema = z.object({
  password: z.string().min(12, 'Use at least 12 characters.'),
  password_confirmation: z.string(),
}).refine((values) => values.password === values.password_confirmation, {
  message: 'Passwords do not match.',
  path: ['password_confirmation'],
})
type FormValues = z.infer<typeof schema>

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const email = searchParams.get('email') ?? ''
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({ resolver: zodResolver(schema) })
  const mutation = useMutation({ mutationFn: (values: FormValues) => resetPassword({ ...values, token, email }) })

  return (
    <div className="auth-card">
      <div className="auth-heading">
        <p className="eyebrow">Secure your account</p>
        <h2>Choose a new password</h2>
        <p>{email || 'Use the recovery link from your email.'}</p>
      </div>
      {mutation.isSuccess ? (
        <div className="success-stack"><div className="alert alert-success">{mutation.data}</div><Link className="button button-primary" to="/login">Return to sign in</Link></div>
      ) : (
        <form onSubmit={handleSubmit((values) => mutation.mutate(values))} noValidate>
          {mutation.isError && <div className="alert alert-error" role="alert">{getFormError(mutation.error)}</div>}
          <label className="field"><FieldLabel label="New password" required /><div className="input-wrap"><LockKeyhole aria-hidden="true" /><input type="password" required {...register('password')} /></div>{errors.password && <small>{errors.password.message}</small>}</label>
          <label className="field"><FieldLabel label="Confirm password" required /><div className="input-wrap"><LockKeyhole aria-hidden="true" /><input type="password" required {...register('password_confirmation')} /></div>{errors.password_confirmation && <small>{errors.password_confirmation.message}</small>}</label>
          <button className="button button-primary" type="submit" disabled={!token || !email || mutation.isPending}>{mutation.isPending ? 'Updating…' : 'Update password'}</button>
        </form>
      )}
    </div>
  )
}
