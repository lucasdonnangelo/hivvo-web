import type { InvoiceStatus } from '../../services/cards'

// Rótulo + estilo (tokens, sem hex) por estado derivado da fatura.
// `atrasada` é o único que exige ação → destacado (vermelho/alerta). `paga` verde
// discreto, `paga_parcial` âmbar (parte paga, ainda resta saldo), `a_vencer`
// neutro, `aberta` informativo (âmbar sutil). `vazia` (competência sem lançamento)
// é o mais discreto — mesmos tokens neutros do `a_vencer`, NUNCA alerta e distinto
// do verde de `paga`.
const STATUS_STYLE: Record<InvoiceStatus, { label: string; className: string }> = {
  atrasada: { label: 'Atrasada', className: 'bg-danger/15 text-danger border-danger/40' },
  paga: { label: 'Paga', className: 'bg-success/15 text-success border-success/30' },
  paga_parcial: { label: 'Paga parcial', className: 'bg-amber/15 text-amber border-amber/40' },
  a_vencer: { label: 'A vencer', className: 'bg-bg-surface text-text-muted border-bg-border' },
  aberta: { label: 'Aberta', className: 'bg-amber/10 text-amber border-amber/30' },
  vazia: { label: 'Vazia', className: 'bg-bg-surface text-text-muted border-bg-border' },
}

// Fallback NEUTRO para status que o front ainda não conhece (um estado futuro da
// API, ou `paga_parcial` até esta fatia estar no ar). Renderiza um badge neutro —
// nunca alerta, nunca em branco, nunca quebra. O rótulo é o próprio código
// humanizado (underscore→espaço, capitalizado), sem afirmar um estado conhecido.
const NEUTRAL_CLASSNAME = 'bg-bg-surface text-text-muted border-bg-border'

function humanizeStatus(status: string): string {
  const limpo = status.replace(/_/g, ' ').trim()
  return limpo ? limpo.charAt(0).toUpperCase() + limpo.slice(1) : '—'
}

export default function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  // Lookup defensivo: a API pode mandar um status fora da união em runtime.
  const style = STATUS_STYLE[status]
  const label = style?.label ?? humanizeStatus(status)
  const className = style?.className ?? NEUTRAL_CLASSNAME
  return (
    <span
      className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${className}`}
    >
      {label}
    </span>
  )
}

// Indicador compacto (dot) para a grade de meses — sinaliza `paga`/`paga_parcial`/
// `atrasada` sem poluir a célula. Demais estados (e qualquer status desconhecido)
// não rendem dot.
export function InvoiceStatusDot({ status }: { status: InvoiceStatus }) {
  const color =
    status === 'atrasada'
      ? 'bg-danger'
      : status === 'paga'
        ? 'bg-success'
        : status === 'paga_parcial'
          ? 'bg-amber'
          : null
  if (!color) return null
  return <span className={`w-1.5 h-1.5 rounded-full ${color}`} aria-hidden />
}
