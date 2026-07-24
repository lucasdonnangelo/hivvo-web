import type { Transaction } from '../../services/transactions'
import { presentTipo } from '../../lib/tipoTransacao'

const formatBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

interface Props {
  tx: Transaction
  onEdit: (tx: Transaction) => void
  onDelete: (tx: Transaction) => void
}

export default function TransactionItem({ tx, onEdit, onDelete }: Props) {
  const pres = presentTipo(tx.tipo)
  const valor = Math.abs(parseFloat(tx.valor))

  return (
    <div className="flex items-center gap-3 py-3 border-b border-bg-border last:border-0">
      <div className="flex flex-col min-w-0 flex-1">
        <span className="text-sm text-text-primary truncate">{tx.descricao}</span>
        <span className="text-xs text-text-muted flex items-center gap-1.5 flex-wrap">
          {tx.categoria} · {tx.forma_pagamento}
          {tx.parcelado && tx.total_parcelas && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber/15 text-amber border border-amber/30">
              {tx.total_parcelas}x
            </span>
          )}
          {pres.badge && (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${pres.badgeClass}`}>
              {pres.badge}
            </span>
          )}
        </span>
      </div>
      <span className={`text-sm font-medium shrink-0 ${pres.amountClass}`}>
        {pres.sign}{formatBRL(valor)}
      </span>
      <div className="flex gap-1 shrink-0">
        <button
          onClick={() => onEdit(tx)}
          className="w-7 h-7 flex items-center justify-center rounded text-text-muted hover:text-text-primary hover:bg-bg-border transition-colors text-sm"
          aria-label={`Editar ${tx.descricao}`}
        >
          ✎
        </button>
        <button
          onClick={() => onDelete(tx)}
          className="w-7 h-7 flex items-center justify-center rounded text-text-muted hover:text-danger hover:bg-bg-border transition-colors text-xs"
          aria-label={`Deletar ${tx.descricao}`}
        >
          ✕
        </button>
      </div>
    </div>
  )
}
