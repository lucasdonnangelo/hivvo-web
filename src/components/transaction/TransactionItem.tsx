import type { Transaction } from '../../services/transactions'

const formatBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

interface Props {
  tx: Transaction
  onEdit: (tx: Transaction) => void
  onDelete: (tx: Transaction) => void
}

export default function TransactionItem({ tx, onEdit, onDelete }: Props) {
  const isReceita = tx.tipo === 'receita'
  const valor = Math.abs(parseFloat(tx.valor))

  return (
    <div className="flex items-center gap-3 py-3 border-b border-bg-border last:border-0">
      <div className="flex flex-col min-w-0 flex-1">
        <span className="text-sm text-text-primary truncate">{tx.descricao}</span>
        <span className="text-xs text-text-muted">
          {tx.categoria} · {tx.forma_pagamento}
          {tx.parcelado && ' · Parcelado'}
        </span>
      </div>
      <span
        className={`text-sm font-medium shrink-0 ${
          isReceita ? 'text-success' : 'text-danger'
        }`}
      >
        {isReceita ? '+' : '−'}{formatBRL(valor)}
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
