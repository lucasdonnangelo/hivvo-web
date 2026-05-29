import { useEffect, useState, type ReactNode } from 'react'
import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { useBreakpoint } from './hooks/useBreakpoint'
import AuthLayout from './layouts/AuthLayout'
import DesktopLayout from './layouts/DesktopLayout'
import MobileLayout from './layouts/MobileLayout'
import LoginPage from './pages/Auth/LoginPage'
import RegisterPage from './pages/Auth/RegisterPage'
import DashboardPage from './pages/Dashboard/DashboardPage'
import TransactionsPage from './pages/Transactions/TransactionsPage'
import { getMe } from './services/auth'
import { useAuthStore } from './store/authStore'
const AddTransaction = () => <div className="p-6 text-text-primary">Adicionar Transação</div>
const Cards = () => <div className="p-6 text-text-primary">Cartões</div>
const Assistant = () => <div className="p-6 text-text-primary">Assistente IA</div>

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
            <Route path="/add" element={<AddTransaction />} />
            <Route path="/cards" element={<Cards />} />
            <Route path="/assistant" element={<Assistant />} />
          </Route>
        </Route>
      </Routes>
    </AuthInitializer>
  )
}
