import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { apiClient } from '../../services/api-client'
import { clearSessionCache, currentUserQueryKey } from './session-cache'

export function AuthSessionBoundary() {
  const client = useQueryClient()
  const navigate = useNavigate()
  const location = useLocation()
  const destination = useRef('')
  destination.current = location.pathname + location.search + location.hash

  useEffect(() => {
    let expiring = false
    const interceptor = apiClient.interceptors.response.use(response => response, async error => {
      const status = error.response?.status
      const hasSession = Boolean(client.getQueryData(currentUserQueryKey))
      if (status === 401 && hasSession && !expiring && !error.config?.url?.endsWith('/auth/login')) {
        expiring = true
        const from = destination.current
        await clearSessionCache(client, 'expired')
        navigate('/login', { replace: true, state: { from, reason: 'session-expired' } })
        expiring = false
      } else if (status === 419 && hasSession) {
        // CSRF errors can mean an expired session. Confirm through a safe GET.
        void apiClient.get('/api/v1/auth/user').catch(() => {})
      }
      return Promise.reject(error)
    })
    return () => apiClient.interceptors.response.eject(interceptor)
  }, [client, navigate])

  return <Outlet />
}
