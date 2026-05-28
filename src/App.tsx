import { Navigate, Route, Routes } from 'react-router-dom'
import { useBreakpoint } from './hooks/useBreakpoint'
import AuthLayout from './layouts/AuthLayout'
import DesktopLayout from './layouts/DesktopLayout'
import MobileLayout from './layouts/MobileLayout'

// Páginas — implementadas a partir da Tarefa #10
const Dashboard = () => <div className="p-lg text-text-primary">Dashboard</div>
const Transactions = () => <div className="p-lg text-text-primary">Transações</div>
const AddTransaction = () => <div className="p-lg text-text-primary">Adicionar Transação</div>
const Cards = () => <div className="p-lg text-text-primary">Cartões</div>
const Assistant = () => <div className="p-lg text-text-primary">Assistente IA</div>
const Login = () => <div className="p-lg text-text-primary">Login</div>
const Register = () => <div className="p-lg text-text-primary">Cadastro</div>

function AppLayout() {
  const isMobile = useBreakpoint('md')
  return isMobile ? <MobileLayout /> : <DesktopLayout />
}

export default function App() {
  return (
    <Routes>
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Route>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/transactions" element={<Transactions />} />
        <Route path="/add" element={<AddTransaction />} />
        <Route path="/cards" element={<Cards />} />
        <Route path="/assistant" element={<Assistant />} />
      </Route>
    </Routes>
  )
}
