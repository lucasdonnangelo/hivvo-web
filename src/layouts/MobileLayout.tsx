import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

const tabs = [
  { to: '/dashboard',    label: 'Início',      icon: '⊞' },
  { to: '/transactions', label: 'Transações',  icon: '↕' },
  { to: '/add',          label: '',            icon: '+', isFab: true },
  { to: '/cards',        label: 'Cartões',     icon: '▭' },
  { to: '/assistant',    label: 'IA',          icon: '✦' },
]

export default function MobileLayout() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const initial = user?.username?.[0].toUpperCase() ?? '?'
  return (
    <div className="flex flex-col h-full bg-bg text-text-primary">
      {/* Header */}
      <header className="shrink-0 flex items-center justify-between px-4 h-14 bg-bg-surface border-b border-bg-border">
        <span className="text-base font-medium tracking-tight select-none">
          <span className="text-text-primary">Bee</span>
          <span className="text-amber">Free</span>
        </span>
        <button
          onClick={() => navigate('/settings')}
          className="w-8 h-8 rounded-full bg-bg-border flex items-center justify-center text-text-muted text-xs hover:bg-bg-border/80 transition-colors"
          aria-label="Configurações"
        >
          {initial}
        </button>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>

      {/* Bottom tab bar */}
      <nav className="shrink-0 flex items-end h-16 bg-bg-surface border-t border-bg-border px-1">
        {tabs.map((tab) =>
          tab.isFab ? (
            <NavLink
              key={tab.to}
              to={tab.to}
              className="flex-1 flex justify-center"
              aria-label="Adicionar transação"
            >
              <span className="mb-4 w-14 h-14 rounded-full bg-amber flex items-center justify-center text-bg text-2xl font-light shadow-lg">
                +
              </span>
            </NavLink>
          ) : (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center justify-center gap-0.5 pb-1 text-xs transition-colors ${
                  isActive ? 'text-amber' : 'text-text-muted'
                }`
              }
            >
              <span className="text-base leading-none">{tab.icon}</span>
              <span>{tab.label}</span>
            </NavLink>
          ),
        )}
      </nav>
    </div>
  )
}
