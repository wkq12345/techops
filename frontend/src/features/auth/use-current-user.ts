import { useQuery } from '@tanstack/react-query'
import { getCurrentUser } from './auth-api'

import { currentUserQueryKey } from './session-cache'
export { currentUserQueryKey } from './session-cache'

export function useCurrentUser() {
  return useQuery({
    queryKey: currentUserQueryKey,
    queryFn: getCurrentUser,
    retry: false,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  })
}
