import type { QueryClient } from '@tanstack/react-query'

export const currentUserQueryKey = ['auth', 'user'] as const
export const sessionEndQueryKey = ['auth', 'session-end'] as const

export async function clearSessionCache(client: QueryClient, reason: 'signed-out' | 'expired' = 'signed-out') {
  await client.cancelQueries()
  // Retain the observed auth query so protected routes immediately see null.
  client.removeQueries({ predicate: query => query.queryKey[0] !== 'auth' })
  client.setQueryData(sessionEndQueryKey, reason)
  client.setQueryData(currentUserQueryKey, null)
}
