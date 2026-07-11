import type { Card } from '../../services/cards'

const formatBRL = (v: string | number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    typeof v === 'string' ? parseFloat(v) : v,
  )

const TIPO_LABEL: Record<Card['tipo'], string> = {
  'Crédito': 'Crédito',
  'Débito': 'Débito',
  'Ambos': 'Crédito e Débito',
}

interface CardVisualProps {
  card: Card
  selected?: boolean
  onClick?: () => void
}

export default function CardVisual({ card, selected, onClick }: CardVisualProps) {
  // Limite pode ser null (cartão sem limite pré-definido) — degrada sem barra nem
  // percentual (nada de NaN%/divisão por null). `hasLimite` guarda TODO o cálculo.
  const limite = card.limite != null ? parseFloat(card.limite) : NaN
  const hasLimite = !isNaN(limite) && limite > 0
  const usado = parseFloat(card.fatura_aberta_total ?? '0')
  const disponivel = hasLimite ? Math.max(0, limite - usado) : 0
  const pct = hasLimite ? Math.min(100, (usado / limite) * 100) : 0

  return (
    <button
      onClick={onClick}
      className={[
        'relative w-full rounded-xl p-5 text-left transition-all select-none',
        'bg-gradient-to-br from-amber-dark via-amber to-amber-light',
        selected
          ? 'ring-2 ring-amber ring-offset-2 ring-offset-bg shadow-lg shadow-amber/20'
          : 'opacity-80 hover:opacity-100',
      ].join(' ')}
    >
      {/* top row */}
      <div className="flex items-start justify-between mb-6">
        <span className="text-bg font-semibold text-base tracking-tight truncate max-w-[160px]">
          {card.nome}
        </span>
        <span className="bg-bg/20 text-bg/80 text-xs font-medium rounded-full px-2 py-0.5 whitespace-nowrap shrink-0">
          {TIPO_LABEL[card.tipo]}
        </span>
      </div>

      {/* limit + usage bar */}
      <div>
        <p className="text-bg/60 text-xs mb-0.5">Limite</p>
        {hasLimite ? (
          <>
            <p className="text-bg font-semibold text-lg">{formatBRL(limite)}</p>
            <div className="mt-2">
              <div className="w-full h-1 rounded-full bg-bg/20 overflow-hidden">
                <div
                  className="h-full rounded-full bg-bg/60 transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="mt-1 text-[10px] text-bg/60">
                {formatBRL(usado)} usado · {formatBRL(disponivel)} disponível
              </p>
            </div>
          </>
        ) : (
          <>
            <p className="text-bg font-semibold text-lg">Sem limite definido</p>
            {usado > 0 && (
              <p className="mt-1 text-[10px] text-bg/60">{formatBRL(usado)} usado</p>
            )}
          </>
        )}
      </div>
    </button>
  )
}
