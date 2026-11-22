import type { ApiResponse, AuthUser } from '../../types/api'
import { apiClient } from '../../services/api-client'

export interface LoginInput {
  email: string
  password: string
  remember: boolean
}

export interface ResetPasswordInput {
  token: string
  email: string
  password: string
  password_confirmation: string
}

export async function getCurrentUser(): Promise<AuthUser> {
  const response = await apiClient.get<ApiResponse<AuthUser>>('/api/v1/auth/user')
  return response.data.data
}

export async function login(input: LoginInput): Promise<AuthUser> {
  await apiClient.get('/sanctum/csrf-cookie')
  const response = await apiClient.post<ApiResponse<AuthUser>>('/api/v1/auth/login', input)
  return response.data.data
}

export async function logout(): Promise<void> {
  await apiClient.post('/api/v1/auth/logout')
}

export async function changePassword(input: { current_password: string; password: string; password_confirmation: string }): Promise<string> {
  const response = await apiClient.put<ApiResponse<null>>('/api/v1/auth/password', input)
  return response.data.message ?? 'Password updated.'
}

export async function forgotPassword(email: string): Promise<string> {
  await apiClient.get('/sanctum/csrf-cookie')
  const response = await apiClient.post<ApiResponse<null>>('/api/v1/auth/forgot-password', { email })
  return response.data.message ?? 'Password reset link sent.'
}

export async function resetPassword(input: ResetPasswordInput): Promise<string> {
  await apiClient.get('/sanctum/csrf-cookie')
  const response = await apiClient.post<ApiResponse<null>>('/api/v1/auth/reset-password', input)
  return response.data.message ?? 'Password reset successfully.'
}
