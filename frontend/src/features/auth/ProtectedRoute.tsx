import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { LoaderCircle } from 'lucide-react'
import { useCurrentUser } from './use-current-user'
import axios from 'axios'
import { Button } from '../../components/ui/Button'
import { useQueryClient } from '@tanstack/react-query'
import { sessionEndQueryKey } from './session-cache'

export function ProtectedRoute() {
  const location = useLocation()
  const client = useQueryClient()
  const { data: user, isLoading, isError, error, refetch } = useCurrentUser()

  if (isLoading) {
    return (
      <main className="screen-loader" aria-label="Loading your workspace">
        <LoaderCircle className="spinner" aria-hidden="true" />
        <span>Opening your workspace…</span>
      </main>
    )
  }

  if (!user) {
    if (isError && (!axios.isAxiosError(error) || error.response?.status !== 401)) return <main className="screen-loader"><p role="alert">Unable to check your session. Check the connection and try again.</p><Button onClick={() => void refetch()}>Retry</Button></main>
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search + location.hash, reason: client.getQueryData(sessionEndQueryKey) === 'expired' ? 'session-expired' : undefined }} />
  }

  return <Outlet />
}
