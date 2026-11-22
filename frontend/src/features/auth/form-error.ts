import axios from 'axios'
import type { ApiValidationError } from '../../types/api'

export function getFormError(error: unknown): string {
  if (axios.isAxiosError<ApiValidationError>(error)) {
    if (error.response?.status === 419) return 'Your session needs to be refreshed. Reload this page and try again.'
    if (error.response?.status === 429) return 'Too many attempts. Wait a minute before trying again.'
    const firstFieldError = Object.values(error.response?.data.errors ?? {})[0]?.[0]
    return firstFieldError ?? error.response?.data.message ?? 'The request could not be completed.'
  }

  return 'The request could not be completed.'
}
