import type { InvoiceListItem } from '../../services/cards'

const MONTHS_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

const formatBRL = (v: string) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseFloat(v))

interface InvoiceMonthGridProps {
  invoices: InvoiceListItem[]
  selectedMes: number
  selectedAno: number
  onSelect: (ano: number, mes: number) => void
}

export default function InvoiceMonthGrid({
  invoices,
  selectedMes,
  selectedAno,
  onSelect,
}: InvoiceMonthGridProps) {
  const byKey = new Map(invoices.map((inv) => [`${inv.ano}-${inv.mes}`, inv]))

  const now = new Date()
  const currentYear = now.getFullYear()

  const years = [...new Set([currentYear - 1, currentYear, ...invoices.map((i) => i.ano)])].sort()

  return (
    <div className="flex flex-col gap-4">
      {years.map((year) => (
        <div key={year}>
          <p className="text-xs font-medium text-text-muted mb-2">{year}</p>
          <div className="grid grid-cols-6 gap-1.5">
            {MONTHS_SHORT.map((label, idx) => {
              const mes = idx + 1
              const key = `${year}-${mes}`
              const inv = byKey.get(key)
              const isSelected = selectedMes === mes && selectedAno === year
              const isFutura = inv?.status === 'futura' || !inv

              return (
                <button
                  key={key}
                  onClick={() => onSelect(year, mes)}
                  className={[
                    'flex flex-col items-center justify-center rounded-lg py-2 px-1 transition-all text-center',
                    isSelected
                      ? 'bg-amber text-bg font-semibold'
                      : isFutura
                        ? 'bg-bg-surface text-text-muted opacity-50 hover:opacity-70'
                        : 'bg-bg-surface text-text-primary hover:bg-bg-border',
                  ].join(' ')}
                >
                  <span className="text-xs">{label}</span>
                  {inv && !isFutura && (
                    <span className={`text-[10px] mt-0.5 ${isSelected ? 'text-bg/70' : 'text-text-muted'}`}>
                      {formatBRL(inv.total).replace('R$ ', '')}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
