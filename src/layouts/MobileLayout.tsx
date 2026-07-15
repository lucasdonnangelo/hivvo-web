import { Suspense } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import RouteFallback from '../components/ui/RouteFallback'
import ProfileMenu from '../components/layout/ProfileMenu'
import { initialDoUsuario } from '../lib/userInitial'

const tabs = [
  { to: '/dashboard',    label: 'Início',      icon: '⊞' },
  { to: '/transactions', label: 'Transações',  icon: '⇄' },
  { to: '/add',          label: '',            icon: '+', isFab: true },
  { to: '/cards',        label: 'Cartões',     icon: '▭' },
  { to: '/assistant',    label: 'IA',          icon: '✦' },
]

export default function MobileLayout() {
  const user = useAuthStore((s) => s.user)
  const initial = initialDoUsuario(user?.nome_completo, user?.email)
  return (
    <div className="flex flex-col h-full bg-bg text-text-primary">
      {/* Header */}
      <header className="shrink-0 flex items-center justify-between px-4 h-14 bg-bg-surface border-b border-bg-border">
        <Link
          to="/dashboard"
          aria-label="Ir para o início"
          className="text-base font-medium tracking-tight select-none cursor-pointer rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-amber"
        >
          <span className="text-text-primary">Hi</span>
          <span className="text-amber">vvo</span>
        </Link>
        <ProfileMenu
          placement="down"
          className="relative w-8 h-8 rounded-full bg-bg-border flex items-center justify-center text-text-muted text-xs hover:bg-bg-border/80 transition-colors"
        >
          {initial}
          <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-bg-surface border border-bg-border flex items-center justify-center text-[8px] text-text-muted leading-none">
            ⚙
          </span>
        </ProfileMenu>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto">
        <Suspense fallback={<RouteFallback />}>
          <Outlet />
        </Suspense>
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
              {/* Círculo 56px CENTRADO na barra de 64px (mb-1 = folga de ~4px em
                  cima e embaixo): antes o mb-4 empurrava ~8px do topo do botão
                  PARA FORA da barra (h-16), e essa borda saliente é o que aparecia
                  cortada no mobile. Agora o botão cabe inteiro e permanece clicável. */}
              <span className="mb-1 w-14 h-14 rounded-full bg-amber flex items-center justify-center text-bg text-2xl font-light shadow-lg">
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
