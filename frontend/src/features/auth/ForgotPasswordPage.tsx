import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { ArrowLeft, Mail } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { z } from 'zod'
import { forgotPassword } from './auth-api'
import { getFormError } from './form-error'
import { FieldLabel } from '../../components/ui/Field'

const schema = z.object({ email: z.email('Enter a valid email address.') })
type FormValues = z.infer<typeof schema>

export function ForgotPasswordPage() {
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({ resolver: zodResolver(schema) })
  const mutation = useMutation({ mutationFn: ({ email }: FormValues) => forgotPassword(email) })

  return (
    <div className="auth-card">
      <Link className="back-link" to="/login"><ArrowLeft aria-hidden="true" /> Back to sign in</Link>
      <div className="auth-heading">
        <p className="eyebrow">Account recovery</p>
        <h2>Reset your password</h2>
        <p>We’ll send recovery instructions to your staff email.</p>
      </div>
      <form onSubmit={handleSubmit((values) => mutation.mutate(values))} noValidate>
        {mutation.isSuccess && <div className="alert alert-success" role="status">{mutation.data}</div>}
        {mutation.isError && <div className="alert alert-error" role="alert">{getFormError(mutation.error)}</div>}
        <label className="field">
          <FieldLabel label="Email address" required />
          <div className="input-wrap"><Mail aria-hidden="true" /><input type="email" required autoComplete="email" {...register('email')} /></div>
          {errors.email && <small>{errors.email.message}</small>}
        </label>
        <button className="button button-primary" type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Sending…' : 'Send reset link'}
        </button>
      </form>
    </div>
  )
}
