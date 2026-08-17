import { Suspense } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import RouteFallback from '../components/ui/RouteFallback'
import ProfileMenu from '../components/layout/ProfileMenu'
import { initialDoUsuario } from '../lib/userInitial'

const navItems = [
  { to: '/dashboard',    label: 'Dashboard',   icon: '⊞' },
  { to: '/transactions', label: 'Transações',  icon: '↕' },
  { to: '/add',          label: 'Adicionar',   icon: '+' },
  { to: '/cards',        label: 'Cartões',     icon: '▭' },
  { to: '/assistant',    label: 'IA',          icon: '✦' },
]

export default function DesktopLayout() {
  const user = useAuthStore((s) => s.user)
  const initial = initialDoUsuario(user?.nome_completo, user?.email)
  return (
    <div className="flex h-full bg-bg text-text-primary">
      {/* Sidebar — 72px, ícones + labels */}
      <aside className="w-[72px] shrink-0 flex flex-col items-center py-4 gap-1 bg-bg-surface border-r border-bg-border">
        <Link
          to="/dashboard"
          title="Hivvo"
          aria-label="Ir para o início"
          className="text-amber font-medium text-sm mb-4 select-none cursor-pointer rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-amber"
        >
          H
        </Link>

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

        <ProfileMenu
          placement="up"
          className="flex flex-col items-center gap-0.5 text-text-muted hover:text-text-primary transition-colors"
        >
          <span className="w-7 h-7 rounded-full bg-bg-border flex items-center justify-center text-xs">
            {initial}
          </span>
          <span className="text-[10px] leading-none tracking-tight">Conta</span>
        </ProfileMenu>
      </aside>

      {/* Main */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* `relative` NÃO é decoração e não é supérfluo — não remova. Mesmo
            motivo do MobileLayout, onde o comentário longo mora: o scroller
            precisa estabelecer bloco continente, senão um `absolute` sem
            `relative` local devolve o transbordo ao documento e rola o shell.
            Aqui pelo mesmo padrão, não por sintoma observado: o defeito foi
            visto no mobile, mas a cadeia é a mesma e o próximo `absolute` pode
            nascer numa tela só de desktop. */}
        <main className="relative flex-1 overflow-y-auto">
          <Suspense fallback={<RouteFallback />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  )
}
