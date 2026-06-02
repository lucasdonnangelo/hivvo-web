import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

const navItems = [
  { to: '/dashboard',    label: 'Dashboard',   icon: '⊞' },
  { to: '/transactions', label: 'Transações',  icon: '↕' },
  { to: '/add',          label: 'Adicionar',   icon: '+' },
  { to: '/cards',        label: 'Cartões',     icon: '▭' },
  { to: '/assistant',    label: 'IA',          icon: '✦' },
]

export default function DesktopLayout() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const initial = user?.username?.[0].toUpperCase() ?? '?'
  return (
    <div className="flex h-full bg-bg text-text-primary">
      {/* Sidebar — 72px, ícones + labels */}
      <aside className="w-[72px] shrink-0 flex flex-col items-center py-4 gap-1 bg-bg-surface border-r border-bg-border">
        <span
          className="text-amber font-medium text-sm mb-4 select-none"
          title="Hivvo"
        >
          H
        </span>

        <nav className="flex flex-col gap-1 flex-1 w-full px-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              title={item.label}
              className={({ isActive }) =>
                `w-full flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-md transition-colors ${
                  isActive
                    ? 'bg-amber text-bg'
                    : 'text-text-muted hover:text-text-primary hover:bg-bg-border'
                }`
              }
            >
              <span className="text-base leading-none">{item.icon}</span>
              <span className="text-[10px] leading-none tracking-tight">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <button
          onClick={() => navigate('/settings')}
          className="flex flex-col items-center gap-0.5 text-text-muted hover:text-text-primary transition-colors"
          title="Configurações"
          aria-label="Configurações"
        >
          <span className="w-7 h-7 rounded-full bg-bg-border flex items-center justify-center text-xs">
            {initial}
          </span>
          <span className="text-[10px] leading-none tracking-tight">Config.</span>
        </button>
      </aside>

      {/* Main */}
      <div className="flex flex-col flex-1 min-w-0">
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
