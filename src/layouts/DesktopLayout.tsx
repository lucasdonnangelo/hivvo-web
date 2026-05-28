import { NavLink, Outlet } from 'react-router-dom'

const navItems = [
  { to: '/dashboard',    label: 'Dashboard',   icon: '⊞' },
  { to: '/transactions', label: 'Transações',  icon: '↕' },
  { to: '/add',          label: 'Adicionar',   icon: '+' },
  { to: '/cards',        label: 'Cartões',     icon: '▭' },
  { to: '/assistant',    label: 'IA',          icon: '✦' },
]

export default function DesktopLayout() {
  return (
    <div className="flex h-full bg-bg text-text-primary">
      {/* Sidebar — 52px, ícones */}
      <aside className="w-[52px] shrink-0 flex flex-col items-center py-4 gap-1 bg-bg-surface border-r border-bg-border">
        <span
          className="text-amber font-medium text-sm mb-4 select-none"
          title="BeeFree"
        >
          B
        </span>

        <nav className="flex flex-col gap-1 flex-1 w-full items-center">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              title={item.label}
              className={({ isActive }) =>
                `w-10 h-10 flex items-center justify-center rounded-md text-base transition-colors ${
                  isActive
                    ? 'bg-amber text-bg'
                    : 'text-text-muted hover:text-text-primary hover:bg-bg-border'
                }`
              }
            >
              {item.icon}
            </NavLink>
          ))}
        </nav>

        <button
          className="w-8 h-8 rounded-full bg-bg-border flex items-center justify-center text-text-muted text-xs"
          title="Perfil"
          aria-label="Perfil"
        >
          P
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
