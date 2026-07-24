import type { Transaction } from '../../services/transactions'
import { tipoNetFactor } from '../../lib/tipoTransacao'
import TransactionItem from './TransactionItem'

const formatBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

const formatGroupDate = (dateStr: string): string => {
  const date = new Date(dateStr + 'T12:00:00')
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (date.toDateString() === today.toDateString()) return 'Hoje'
  if (date.toDateString() === yesterday.toDateString()) return 'Ontem'
  return date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

interface Props {
  date: string
  transactions: Transaction[]
  onEdit: (tx: Transaction) => void
  onDelete: (tx: Transaction) => void
}

export default function TransactionGroup({ date, transactions, onEdit, onDelete }: Props) {
  // Soma o que está no grupo (não reconstrói agregado do backend): estorno é crédito
  // e SOMA (+), despesa subtrai, tipo desconhecido é neutro (0). Ver tipoNetFactor.
  const subtotal = transactions.reduce(
    (acc, tx) => acc + tipoNetFactor(tx.tipo) * parseFloat(tx.valor),
    0,
  )

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-xs font-medium text-text-muted capitalize">
          {formatGroupDate(date)}
        </span>
        <span
          className={`text-xs font-medium ${subtotal >= 0 ? 'text-success' : 'text-danger'}`}
        >
          {subtotal >= 0 ? '+' : '−'}{formatBRL(Math.abs(subtotal))}
        </span>
      </div>
      <div className="bg-bg-surface rounded-lg px-3">
        {transactions.map((tx) => (
          <TransactionItem key={tx.id} tx={tx} onEdit={onEdit} onDelete={onDelete} />
        ))}
      </div>
    </div>
  )
}
