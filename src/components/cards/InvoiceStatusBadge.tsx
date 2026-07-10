import type { InvoiceStatus } from '../../services/cards'

// Rótulo + estilo (tokens, sem hex) por estado derivado da fatura.
// `atrasada` é o único que exige ação → destacado (vermelho/alerta). `paga` verde
// discreto, `a_vencer` neutro, `aberta` informativo (âmbar sutil).
const STATUS_STYLE: Record<InvoiceStatus, { label: string; className: string }> = {
  atrasada: { label: 'Atrasada', className: 'bg-danger/15 text-danger border-danger/40' },
  paga: { label: 'Paga', className: 'bg-success/15 text-success border-success/30' },
  a_vencer: { label: 'A vencer', className: 'bg-bg-surface text-text-muted border-bg-border' },
  aberta: { label: 'Aberta', className: 'bg-amber/10 text-amber border-amber/30' },
}

export default function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const { label, className } = STATUS_STYLE[status]
  return (
    <span
      className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${className}`}
    >
      {label}
    </span>
  )
}

// Indicador compacto (dot) para a grade de meses — sinaliza `paga`/`atrasada` sem
// poluir a célula. Demais estados não rendem dot.
export function InvoiceStatusDot({ status }: { status: InvoiceStatus }) {
  if (status !== 'paga' && status !== 'atrasada') return null
  const color = status === 'atrasada' ? 'bg-danger' : 'bg-success'
  return <span className={`w-1.5 h-1.5 rounded-full ${color}`} aria-hidden />
}
