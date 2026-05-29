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
      <div className="flex items-start justify-between mb-8">
        <span className="text-bg font-semibold text-base tracking-tight truncate max-w-[160px]">
          {card.nome}
        </span>
        <span className="text-bg/70 text-xs font-medium">{TIPO_LABEL[card.tipo]}</span>
      </div>

      {/* limit */}
      <div>
        <p className="text-bg/60 text-xs mb-0.5">Limite</p>
        <p className="text-bg font-semibold text-lg">{formatBRL(card.limite)}</p>
      </div>

      {/* chip decoration */}
      <div className="absolute top-5 right-5 w-8 h-6 rounded-sm bg-amber-dark/40 border border-bg/20" />
    </button>
  )
}
