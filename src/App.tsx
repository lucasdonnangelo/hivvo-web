import { useEffect, useState, type ReactNode } from 'react'
import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { useBreakpoint } from './hooks/useBreakpoint'
import AuthLayout from './layouts/AuthLayout'
import DesktopLayout from './layouts/DesktopLayout'
import MobileLayout from './layouts/MobileLayout'
import LoginPage from './pages/Auth/LoginPage'
import RegisterPage from './pages/Auth/RegisterPage'
import AddTransactionPage from './pages/AddTransaction/AddTransactionPage'
import AssistantPage from './pages/Assistant/AssistantPage'
import CardsPage from './pages/Cards/CardsPage'
import DashboardPage from './pages/Dashboard/DashboardPage'
import TransactionsPage from './pages/Transactions/TransactionsPage'
import SummaryPage from './pages/Transactions/SummaryPage'
import { getMe } from './services/auth'
import { useAuthStore } from './store/authStore'

function AppLayout() {
  const isMobile = useBreakpoint('md')
  return isMobile ? <MobileLayout /> : <DesktopLayout />
}

function ProtectedRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />
}

function AuthInitializer({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const setUser = useAuthStore((s) => s.setUser)

  useEffect(() => {
    getMe()
      .then(setUser)
      .catch(() => {})
      .finally(() => setReady(true))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!ready) return null

  return <>{children}</>
}

export default function App() {
  return (
    <AuthInitializer>
      <Routes>
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/transactions" element={<TransactionsPage />} />
            <Route path="/transactions/summary" element={<SummaryPage />} />
            <Route path="/add" element={<AddTransactionPage />} />
            <Route path="/cards" element={<CardsPage />} />
            <Route path="/assistant" element={<AssistantPage />} />
          </Route>
        </Route>
      </Routes>
    </AuthInitializer>
  )
}
