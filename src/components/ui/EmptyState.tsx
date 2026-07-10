import type { ReactNode } from 'react'

interface EmptyStateProps {
  /** Glifo unicode (o app não usa lib de ícones) */
  icon: ReactNode
  title: string
  description?: string
  /** Ação em destaque (ex.: <Button>). Fica proeminente, não como link discreto. */
  action?: ReactNode
}

/**
 * Molde de empty state do app.
 *
 * Enquadramento superior-central: ancorado no topo (não centralizado no
 * full-height), com o vazio ABAIXO — espaço para crescer, não flutuando no
 * meio da tela. Hierarquia: ícone → título → descrição → ação em destaque.
 *
 * Estabelecido na tela de Cartões; outros empty states serão alinhados a este
 * padrão depois.
 */
export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="w-full flex flex-col items-center text-center px-6 pt-24 pb-16">
      <div className="w-16 h-16 rounded-full bg-bg-surface flex items-center justify-center mb-5">
        <span className="text-amber text-3xl">{icon}</span>
      </div>
      <h2 className="text-text-primary text-lg font-semibold">{title}</h2>
      {description && (
        <p className="text-text-muted text-sm mt-2 max-w-xs">{description}</p>
      )}
      {action && <div className="mt-6 w-full max-w-[220px]">{action}</div>}
    </div>
  )
}
