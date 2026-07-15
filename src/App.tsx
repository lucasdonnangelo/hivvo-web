import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react'
import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { useBreakpoint } from './hooks/useBreakpoint'
// Shell eager (não pode suspender): layouts + infra de inicialização.
import AuthLayout from './layouts/AuthLayout'
import DesktopLayout from './layouts/DesktopLayout'
import MobileLayout from './layouts/MobileLayout'
import { getMe } from './services/auth'
import { useAuthStore } from './store/authStore'
import ToastContainer from './components/ui/Toast'
import RouteFallback from './components/ui/RouteFallback'

// Conteúdo das rotas em lazy (FE-11): code-splitting por rota. Isola recharts
// (Dashboard/Summary) e react-markdown (Assistant) do chunk inicial.
const LoginPage = lazy(() => import('./pages/Auth/LoginPage'))
const RegisterPage = lazy(() => import('./pages/Auth/RegisterPage'))
const ForgotPasswordPage = lazy(() => import('./pages/Auth/ForgotPasswordPage'))
const ResetPasswordPage = lazy(() => import('./pages/Auth/ResetPasswordPage'))
const AddTransactionPage = lazy(() => import('./pages/AddTransaction/AddTransactionPage'))
const AssistantPage = lazy(() => import('./pages/Assistant/AssistantPage'))
const CardsPage = lazy(() => import('./pages/Cards/CardsPage'))
const DashboardPage = lazy(() => import('./pages/Dashboard/DashboardPage'))
const ImportPage = lazy(() => import('./pages/Import/ImportPage'))
const ProfilePage = lazy(() => import('./pages/Profile/ProfilePage'))
const SettingsPage = lazy(() => import('./pages/Settings/SettingsPage'))
const TransactionsPage = lazy(() => import('./pages/Transactions/TransactionsPage'))
const SummaryPage = lazy(() => import('./pages/Transactions/SummaryPage'))
const TermsPage = lazy(() => import('./pages/Legal/TermsPage'))
const PrivacyPage = lazy(() => import('./pages/Legal/PrivacyPage'))

function AppLayout() {
  const isMobile = useBreakpoint('md')
  return isMobile ? <MobileLayout /> : <DesktopLayout />
}

function ProtectedRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />
}

function AuthInitializer({ children }: { children: ReactNode }) {
  const [initialized, setInitialized] = useState(false)
  const setUser = useAuthStore((s) => s.setUser)

  useEffect(() => {
    getMe()
      .then(setUser)
      .catch(() => {})
      .finally(() => setInitialized(true))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!initialized) return null

  return <>{children}</>
}

export default function App() {
  return (
    <AuthInitializer>
      <ToastContainer />
      <Routes>
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
        </Route>

        <Route
          path="/terms"
          element={
            <Suspense fallback={<RouteFallback />}>
              <TermsPage />
            </Suspense>
          }
        />
        <Route
          path="/privacy"
          element={
            <Suspense fallback={<RouteFallback />}>
              <PrivacyPage />
            </Suspense>
          }
        />

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/transactions" element={<TransactionsPage />} />
            <Route path="/transactions/summary" element={<SummaryPage />} />
            <Route path="/add" element={<AddTransactionPage />} />
            <Route path="/cards" element={<CardsPage />} />
            <Route path="/assistant" element={<AssistantPage />} />
            <Route path="/import" element={<ImportPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Route>
      </Routes>
    </AuthInitializer>
  )
}
