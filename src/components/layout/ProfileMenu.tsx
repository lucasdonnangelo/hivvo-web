import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { logout } from '../../services/auth'

interface ProfileMenuProps {
  /** Ancoragem do dropdown: header mobile (abre p/ baixo) vs sidebar desktop (abre p/ cima). */
  placement?: 'down' | 'up'
  className?: string
  children: React.ReactNode
  'aria-label'?: string
}

/** Menu do ícone de perfil: Perfil · Configurações · Sair.
 *
 * Antes deste componente o ícone ia direto para /settings — não havia menu algum
 * (o "menu de 5 itens" do plano eram as seções DE DENTRO do SettingsPage).
 */
export default function ProfileMenu({
  placement = 'down',
  className = '',
  children,
  'aria-label': ariaLabel = 'Abrir menu do perfil',
}: ProfileMenuProps) {
  const navigate = useNavigate()
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  // Fecha ao clicar fora ou no Esc — só enquanto aberto.
  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  async function handleLogout() {
    try {
      await logout()
    } catch {
      // Sessão já pode estar inválida no servidor; sair localmente mesmo assim.
    }
    clearAuth()
    navigate('/login', { replace: true })
  }

  function go(to: string) {
    setOpen(false)
    navigate(to)
  }

  const itemClass =
    'w-full text-left px-3 py-2.5 text-sm text-text-primary hover:bg-bg-border transition-colors'

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={className}
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {children}
      </button>

      {open && (
        <div
          role="menu"
          className={`absolute z-50 w-48 rounded-lg bg-bg-surface border border-bg-border shadow-lg overflow-hidden ${
            placement === 'up' ? 'bottom-full mb-2 left-0' : 'top-full mt-2 right-0'
          }`}
        >
          <button role="menuitem" className={itemClass} onClick={() => go('/profile')}>
            Perfil
          </button>
          <button role="menuitem" className={itemClass} onClick={() => go('/settings')}>
            Configurações
          </button>
          <div className="border-t border-bg-border" />
          <button
            role="menuitem"
            className="w-full text-left px-3 py-2.5 text-sm text-danger hover:bg-danger/5 transition-colors"
            onClick={handleLogout}
          >
            Sair
          </button>
        </div>
      )}
    </div>
  )
}
