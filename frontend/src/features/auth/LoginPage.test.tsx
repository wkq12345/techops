import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { LoginPage } from './LoginPage'

vi.mock('./use-current-user', () => ({
  currentUserQueryKey: ['auth', 'user'],
  useCurrentUser: () => ({ data: undefined }),
}))

describe('LoginPage', () => {
  it('shows client-side validation before submitting', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={client}><MemoryRouter><LoginPage /></MemoryRouter></QueryClientProvider>)

    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument()
    expect(await screen.findByText('Password is required.')).toBeInTheDocument()
  })
})
