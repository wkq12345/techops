import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AxiosError } from 'axios'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { apiClient } from '../../services/api-client'
import { AuthSessionBoundary } from './AuthSessionBoundary'
import { ProtectedRoute } from './ProtectedRoute'
import { AccountPage } from './AccountPage'
import { LoginPage } from './LoginPage'
import { clearSessionCache, currentUserQueryKey } from './session-cache'

const user = { id: 1, name: 'Staff', email: 'staff@example.test', roles: ['sales-staff'], permissions: [] }
const originalAdapter = apiClient.defaults.adapter
afterEach(() => { cleanup(); vi.restoreAllMocks(); apiClient.defaults.adapter = originalAdapter })
function clientWithSession() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  client.setQueryData(currentUserQueryKey, user)
  client.setQueryData(['resource', 'products'], { data: [{ id: 1, name: 'Private stock' }] })
  return client
}
function LoginDestination() { const location = useLocation(); return <div>Login destination: {JSON.stringify(location.state)}</div> }
function SignedInDestination() { const location = useLocation(); return <div>Private destination: {location.pathname}{location.search}</div> }

describe('staff session protection', () => {
  it('returns to the requested module after login even when the auth observer updates immediately', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    client.setQueryData(currentUserQueryKey, null)
    apiClient.defaults.adapter = async config => ({ status: 200, statusText: 'OK', headers: {}, config, data: { data: user } })
    render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[{ pathname: '/login', state: { from: '/modules/products?source=signin' } }]}><Routes><Route path="/login" element={<LoginPage />} /><Route path="/modules/products" element={<SignedInDestination />} /><Route path="/dashboard" element={<div>Wrong default destination</div>} /></Routes></MemoryRouter></QueryClientProvider>)
    fireEvent.change(screen.getByRole('textbox', { name: 'Email address' }), { target: { value: 'staff@example.test' } })
    fireEvent.change(screen.getByLabelText(/^Password/), { target: { value: 'original-password' } })
    fireEvent.click(screen.getByRole('button', { name: /^Sign in/ }))
    expect(await screen.findByText(/Private destination/)).toHaveTextContent('/modules/products?source=signin')
    expect(screen.queryByText('Wrong default destination')).not.toBeInTheDocument()
  })

  it('clears business data and publishes a signed-out auth state', async () => {
    const client = clientWithSession()
    await clearSessionCache(client)
    expect(client.getQueryData(['resource', 'products'])).toBeUndefined()
    expect(client.getQueryData(currentUserQueryKey)).toBeNull()
  })

  it('redirects an expired session and preserves the complete requested URL', async () => {
    const client = clientWithSession()
    apiClient.defaults.adapter = async config => { throw new AxiosError('Unauthenticated', 'ERR_BAD_REQUEST', config, undefined, { status: 401, statusText: 'Unauthorized', headers: {}, data: {}, config }) }
    render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/modules/inventory?record=4']}><Routes><Route element={<AuthSessionBoundary />}><Route element={<ProtectedRoute />}><Route path="/modules/inventory" element={<button onClick={() => { void apiClient.get('/api/v1/inventory').catch(() => {}) }}>Load inventory</button>} /></Route><Route path="/login" element={<LoginDestination />} /></Route></Routes></MemoryRouter></QueryClientProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'Load inventory' }))
    expect(await screen.findByText(/Login destination/)).toHaveTextContent('/modules/inventory?record=4')
    expect(screen.getByText(/Login destination/)).toHaveTextContent('session-expired')
    expect(client.getQueryData(['resource', 'products'])).toBeUndefined()
  })

  it('blocks an anonymous direct URL', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    apiClient.defaults.adapter = async config => { throw new AxiosError('Unauthenticated', 'ERR_BAD_REQUEST', config, undefined, { status: 401, statusText: 'Unauthorized', headers: {}, data: {}, config }) }
    render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/modules/products']}><Routes><Route element={<ProtectedRoute />}><Route path="/modules/products" element={<div>Private products</div>} /></Route><Route path="/login" element={<LoginDestination />} /></Routes></MemoryRouter></QueryClientProvider>)
    await screen.findByText(/Login destination/)
    expect(screen.queryByText('Private products')).not.toBeInTheDocument()
  })

  it('shows a retry state for connectivity failures instead of treating them as logout', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    apiClient.defaults.adapter = async config => { throw new AxiosError('Network error', 'ERR_NETWORK', config) }
    render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/dashboard']}><Routes><Route element={<ProtectedRoute />}><Route path="/dashboard" element={<div>Private workspace</div>} /></Route><Route path="/login" element={<div>Login page</div>} /></Routes></MemoryRouter></QueryClientProvider>)
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to check your session')
    expect(screen.queryByText('Login page')).not.toBeInTheDocument()
  })

  it('submits the current and confirmed new passwords and clears password fields', async () => {
    const client = clientWithSession()
    const put = vi.spyOn(apiClient, 'put').mockResolvedValue({ data: { data: null, message: 'Password updated.' } } as never)
    render(<QueryClientProvider client={client}><MemoryRouter><AccountPage /></MemoryRouter></QueryClientProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'Change password' }))
    expect(screen.getByRole('dialog', { name: 'Change password' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/^Current password/), { target: { value: 'original-password' } })
    fireEvent.change(screen.getByLabelText(/^New password/), { target: { value: 'replacement-password' } })
    fireEvent.change(screen.getByLabelText(/^Confirm new password/), { target: { value: 'replacement-password' } })
    fireEvent.click(screen.getByRole('button', { name: 'Update password' }))
    await waitFor(() => expect(put).toHaveBeenCalledWith('/api/v1/auth/password', { current_password: 'original-password', password: 'replacement-password', password_confirmation: 'replacement-password' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Password updated.')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Change password' }))
    expect(screen.getByLabelText(/^Current password/)).toHaveValue('')
  })
})
