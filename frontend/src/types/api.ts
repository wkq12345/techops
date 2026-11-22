export interface ApiResponse<T> {
  data: T
  message?: string
}

export interface ApiValidationError {
  message: string
  errors?: Record<string, string[]>
}

export interface AuthUser {
  id: number
  name: string
  email: string
  roles: string[]
  permissions: string[]
}
