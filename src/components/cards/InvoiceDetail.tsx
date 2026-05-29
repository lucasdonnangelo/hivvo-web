import type { InvoiceDetail as InvoiceDetailType, InvoiceListItem } from '../../services/cards'

const formatBRL = (v: string) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseFloat(v))

const formatDate = (iso: string) => {
  const [year, month, day] = iso.split('-')
  return `${day}/${month}/${year}`
}

interface InvoiceDetailProps {
  detail: InvoiceDetailType
  invoiceMeta?: InvoiceListItem
  mes: number
  ano: number
  onExport: () => void
}

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

function InstallmentBadge({ current, total }: { current: number; total: number }) {
  return (
    <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber/15 text-amber border border-amber/30">
      {current}/{total}
    </span>
  )
}

function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h3 className="text-sm font-medium text-text-primary">{title}</h3>
      <span className="text-xs text-text-muted">{count} {count !== 1 ? 'itens' : 'item'}</span>
    </div>
  )
}

export default function InvoiceDetail({ detail, mes, ano, onExport }: InvoiceDetailProps) {
  const isEmpty = detail.parcelas.length === 0 && detail.avulsas.length === 0

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-base font-medium text-text-primary">
            {MONTHS[mes - 1]} {ano}
          </h2>
          {detail.data_vencimento && (
            <p className="text-xs text-text-muted mt-0.5">
              Vence em {formatDate(detail.data_vencimento)}
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="text-xs text-text-muted">Total</p>
          <p className="text-lg font-semibold text-danger">{formatBRL(detail.total)}</p>
        </div>
      </div>

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-10 h-10 rounded-full bg-bg-surface flex items-center justify-center mb-3">
            <span className="text-amber">◇</span>
          </div>
          <p className="text-text-primary text-sm font-medium">Fatura vazia</p>
          <p className="text-text-muted text-xs mt-1">Nenhuma transação neste mês</p>
        </div>
      ) : (
        <>
          {/* Parcelas */}
          {detail.parcelas.length > 0 && (
            <div>
              <SectionHeader title="Parcelas" count={detail.parcelas.length} />
              <div className="flex flex-col gap-1">
                {detail.parcelas.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-bg-surface transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <InstallmentBadge current={p.numero_parcela} total={p.total_parcelas} />
                      <div className="min-w-0">
                        <p className="text-sm text-text-primary truncate">{p.descricao}</p>
                        <p className="text-xs text-text-muted">{p.categoria}</p>
                      </div>
                    </div>
                    <span className="text-sm font-medium text-danger shrink-0 ml-3">
                      {formatBRL(p.valor)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Divider */}
          {detail.parcelas.length > 0 && detail.avulsas.length > 0 && (
            <div className="border-t border-bg-border" />
          )}

          {/* Avulsas */}
          {detail.avulsas.length > 0 && (
            <div>
              <SectionHeader title="Avulsas" count={detail.avulsas.length} />
              <div className="flex flex-col gap-1">
                {detail.avulsas.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-bg-surface transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-text-primary truncate">{t.descricao}</p>
                      <p className="text-xs text-text-muted">{t.categoria} · {formatDate(t.data)}</p>
                    </div>
                    <span className="text-sm font-medium text-danger shrink-0 ml-3">
                      {formatBRL(t.valor)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Export */}
      <div className="pt-2 border-t border-bg-border">
        <button
          onClick={onExport}
          className="flex items-center gap-2 text-xs text-text-muted hover:text-amber transition-colors"
        >
          <span>↓</span>
          Exportar fatura
        </button>
      </div>
    </div>
  )
}
