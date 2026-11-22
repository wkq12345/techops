import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, LockKeyhole, Mail } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { getFormError } from './form-error'
import { login } from './auth-api'
import { currentUserQueryKey, useCurrentUser } from './use-current-user'
import { clearSessionCache } from './session-cache'
import { Button } from '../../components/ui/Button'
import { FieldLabel } from '../../components/ui/Field'

const loginSchema = z.object({
  email: z.email('Enter a valid email address.'),
  password: z.string().min(1, 'Password is required.'),
  remember: z.boolean(),
})

type LoginForm = z.infer<typeof loginSchema>

export function LoginPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const location = useLocation()
  const { data: currentUser } = useCurrentUser()
  const from = (location.state as { from?: string } | null)?.from
  const destination = from?.startsWith('/') && !from.startsWith('//') && !from.startsWith('/login') ? from : '/dashboard'
  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', remember: false },
  })
  const mutation = useMutation({
    mutationFn: login,
    onSuccess: async (user) => {
      await clearSessionCache(queryClient)
      queryClient.setQueryData(currentUserQueryKey, user)
      navigate(destination, { replace: true })
    },
  })

  if (currentUser) return <Navigate to={destination} replace />

  return (
    <div className="auth-card">
      <div className="auth-heading">
        <p className="eyebrow">Staff access</p>
        <h2>Sign in to TechOps</h2>
        <p>Use your staff account to continue.</p>
      </div>

      <form onSubmit={handleSubmit((values) => mutation.mutate(values))} noValidate>
        {(location.state as { reason?: string } | null)?.reason === 'session-expired' && <div className="alert alert-warning" role="status">Your session ended. Sign in again to continue.</div>}
        {mutation.isError && <div className="alert alert-error" role="alert">{getFormError(mutation.error)}</div>}
        <label className="field">
          <FieldLabel label="Email address" required />
          <div className="input-wrap"><Mail aria-hidden="true" /><input type="email" required autoComplete="email" {...register('email')} /></div>
          {errors.email && <small>{errors.email.message}</small>}
        </label>
        <label className="field">
          <FieldLabel label="Password" required />
          <div className="input-wrap"><LockKeyhole aria-hidden="true" /><input type="password" required autoComplete="current-password" {...register('password')} /></div>
          {errors.password && <small>{errors.password.message}</small>}
        </label>
        <div className="form-row">
          <label className="checkbox"><input type="checkbox" {...register('remember')} /> Keep me signed in</label>
          <Link to="/forgot-password">Forgot password?</Link>
        </div>
        <Button className="button-primary" variant="primary" type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Signing in…' : 'Sign in'} <ArrowRight aria-hidden="true" />
        </Button>
      </form>
      <p className="support-note">Need access? Contact your TechOps administrator.</p>
    </div>
  )
}
