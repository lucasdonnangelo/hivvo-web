import { useCompetenciaFaturas } from '../../hooks/useCards'
import type { FaturaCartaoItem } from '../../services/cards'

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

const formatBRL = (v: string) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseFloat(v))

const formatDayMonth = (iso: string) => {
  const [, month, day] = iso.split('-')
  return `${day}/${month}`
}

interface InvoiceByMonthViewProps {
  mes: number
  ano: number
  onPrev: () => void
  onNext: () => void
  onSelectCard: (cardId: number) => void
}

function MonthNav({ mes, ano, onPrev, onNext }: { mes: number; ano: number; onPrev: () => void; onNext: () => void }) {
  return (
    <div className="flex items-center justify-center gap-2">
      <button
        onClick={onPrev}
        className="w-8 h-8 flex items-center justify-center rounded-md text-text-muted hover:text-text-primary hover:bg-bg-surface transition-colors"
        aria-label="Mês anterior"
      >
        ‹
      </button>
      <span className="text-sm font-medium text-text-primary whitespace-nowrap min-w-[140px] text-center">
        {MONTHS[mes - 1]} {ano}
      </span>
      <button
        onClick={onNext}
        className="w-8 h-8 flex items-center justify-center rounded-md text-text-muted hover:text-text-primary hover:bg-bg-surface transition-colors"
        aria-label="Próximo mês"
      >
        ›
      </button>
    </div>
  )
}

function CardRow({ fatura, onClick }: { fatura: FaturaCartaoItem; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-between w-full px-3 py-3 rounded-lg bg-bg-surface hover:bg-bg-border transition-colors text-left"
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-text-primary truncate">{fatura.cartao_nome}</p>
        {fatura.data_vencimento && (
          <p className="text-xs text-text-muted mt-0.5">vence {formatDayMonth(fatura.data_vencimento)}</p>
        )}
      </div>
      <span className="text-sm font-semibold text-danger shrink-0 ml-3">
        {formatBRL(fatura.total)}
      </span>
    </button>
  )
}

export default function InvoiceByMonthView({
  mes,
  ano,
  onPrev,
  onNext,
  onSelectCard,
}: InvoiceByMonthViewProps) {
  const { data, isLoading } = useCompetenciaFaturas(ano, mes)

  return (
    <div className="flex flex-col gap-5 max-w-lg mx-auto w-full">
      <MonthNav mes={mes} ano={ano} onPrev={onPrev} onNext={onNext} />

      {isLoading ? (
        <div className="flex flex-col gap-3">
          <div className="h-16 bg-bg-surface rounded-lg animate-pulse" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 bg-bg-surface rounded-lg animate-pulse" />
          ))}
        </div>
      ) : !data || data.faturas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-10 h-10 rounded-full bg-bg-surface flex items-center justify-center mb-3">
            <span className="text-amber">◇</span>
          </div>
          <p className="text-text-primary text-sm font-medium">Nenhuma fatura em {MONTHS[mes - 1]}</p>
          <p className="text-text-muted text-xs mt-1">Nenhum cartão vence neste mês</p>
        </div>
      ) : (
        <>
          {/* Total agregado em destaque */}
          <div className="flex items-baseline justify-between rounded-xl bg-bg-surface px-4 py-3">
            <span className="text-sm text-text-muted">Total de {MONTHS[mes - 1]}</span>
            <span className="text-lg font-semibold text-danger">{formatBRL(data.total_geral)}</span>
          </div>

          {/* Uma linha por cartão com fatura no mês */}
          <div className="flex flex-col gap-2">
            {data.faturas.map((f) => (
              <CardRow key={f.cartao_id} fatura={f} onClick={() => onSelectCard(f.cartao_id)} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
