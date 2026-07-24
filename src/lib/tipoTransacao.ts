// Apresentação de uma transação por `tipo` — fonte ÚNICA para a lista, o dashboard
// e o detalhe de fatura. Espelha o fallback NEUTRO do status (InvoiceStatusBadge):
// a API pode mandar um `tipo` fora da união conhecida em runtime, e o front degrada
// para neutro em vez de quebrar.
//
// `estorno` é um crédito/reembolso que ABATE o consumo — NÃO é renda (receita) nem
// despesa. Por isso ganha cor/rótulo próprios, distinto dos dois. Valor chega
// positivo (o montante reembolsado); nada é netado no front — o backend já entrega
// líquido nos agregados.

export interface TipoPresentation {
  // false quando o tipo caiu no fallback (a API mandou algo que ainda não conhecemos)
  known: boolean
  // rótulo humano: 'Receita' | 'Despesa' | 'Estorno' | tipo humanizado
  label: string
  // prefixo do valor exibido. '' = sem sinal (neutro).
  sign: '+' | '−' | ''
  // token de cor do valor (nunca hex)
  amountClass: string
  // texto do selo/pill; null nos tipos "norma" (receita/despesa), onde sinal+cor bastam
  badge: string | null
  // classes do selo/pill (só usadas quando badge != null)
  badgeClass: string
  // contribuição ao somar num total líquido local: receita/estorno +1 (crédito
  // abate/soma), despesa −1, desconhecido 0 (neutro — não distorce o que não entende)
  netFactor: 1 | -1 | 0
}

// Mesmo par de tokens dos selos já existentes (parcelado = amber; status neutro).
const AMBER_BADGE = 'bg-amber/15 text-amber border border-amber/30'
const NEUTRAL_BADGE = 'bg-bg-surface text-text-muted border border-bg-border'

// underscore→espaço, capitalizado; '—' se vazio. Igual ao humanizeStatus do badge.
function humanizeTipo(tipo: string): string {
  const limpo = tipo.replace(/_/g, ' ').trim()
  return limpo ? limpo.charAt(0).toUpperCase() + limpo.slice(1) : '—'
}

export function presentTipo(tipo: string): TipoPresentation {
  switch (tipo) {
    case 'receita':
      return { known: true, label: 'Receita', sign: '+', amountClass: 'text-success', badge: null, badgeClass: '', netFactor: 1 }
    case 'despesa':
      return { known: true, label: 'Despesa', sign: '−', amountClass: 'text-danger', badge: null, badgeClass: '', netFactor: -1 }
    case 'estorno':
      return { known: true, label: 'Estorno', sign: '+', amountClass: 'text-amber', badge: 'Estorno', badgeClass: AMBER_BADGE, netFactor: 1 }
    default: {
      const humano = humanizeTipo(tipo)
      return { known: false, label: humano, sign: '', amountClass: 'text-text-muted', badge: humano, badgeClass: NEUTRAL_BADGE, netFactor: 0 }
    }
  }
}

// Atalho para somar uma transação num total líquido local (sem reconstruir agregado
// do backend — só soma o que está na tela). Desconhecido = 0.
export const tipoNetFactor = (tipo: string): number => presentTipo(tipo).netFactor
