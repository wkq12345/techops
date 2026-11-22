import { Navigate, Route, Routes } from 'react-router-dom'
import { DashboardLayout } from './components/layout/DashboardLayout'
import { AuthLayout } from './features/auth/AuthLayout'
import { ForgotPasswordPage } from './features/auth/ForgotPasswordPage'
import { LoginPage } from './features/auth/LoginPage'
import { ProtectedRoute } from './features/auth/ProtectedRoute'
import { ResetPasswordPage } from './features/auth/ResetPasswordPage'
import { DashboardPage } from './features/dashboard/DashboardPage'
import { ResourcePage } from './features/resources/ResourcePage'
import { AuthSessionBoundary } from './features/auth/AuthSessionBoundary'
import { AccountPage } from './features/auth/AccountPage'

export default function App() {
  return (
    <Routes>
      <Route element={<AuthSessionBoundary />}>
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
      </Route>
      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/modules/:resource" element={<ResourcePage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  )
}
