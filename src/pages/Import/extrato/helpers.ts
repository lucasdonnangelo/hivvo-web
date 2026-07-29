import type {
  EnriquecimentoLinha,
  ExtratoPreviewResponse,
  FaturaCandidata,
  LinhaExtrato,
} from '../../../services/importExtrato'

export { formatBRL, formatCompetencia } from '../fatura/helpers'

// ── Apresentação por balde — o mesmo molde do presentTipo (lib/tipoTransacao):
// a API pode mandar um balde fora da união conhecida em runtime, e o front
// degrada para neutro (sem sinal, sem importar) em vez de quebrar. ──

const NEUTRAL_BADGE = 'bg-bg-surface text-text-muted border border-bg-border'

// underscore→espaço, capitalizado; '—' se vazio. Igual ao humanizeStatus do badge.
function humanize(codigo: string): string {
  const limpo = codigo.replace(/_/g, ' ').trim()
  return limpo ? limpo.charAt(0).toUpperCase() + limpo.slice(1) : '—'
}

export interface BaldePresentation {
  // false quando o balde caiu no fallback (a API mandou algo que não conhecemos)
  known: boolean
  label: string
  // prefixo do valor exibido ('' = neutro). `valor` é magnitude — o sinal é só
  // apresentação da direção, nunca aritmética.
  sign: '+' | '−' | ''
  amountClass: string
}

export function presentBalde(balde: string): BaldePresentation {
  switch (balde) {
    case 'receita':
      return { known: true, label: 'Receita', sign: '+', amountClass: 'text-success' }
    case 'debito':
      return { known: true, label: 'Débito', sign: '−', amountClass: 'text-danger' }
    case 'pagamento_fatura':
      return { known: true, label: 'Pagamento de fatura', sign: '−', amountClass: 'text-text-primary' }
    default:
      return { known: false, label: humanize(balde), sign: '', amountClass: 'text-text-muted' }
  }
}

// Selo neutro para balde/status desconhecido (a rede de sempre).
export const neutralBadge = (codigo: string) => ({
  label: humanize(codigo),
  className: NEUTRAL_BADGE,
})

// ── Join linhas↔enriquecimento: por `indice` EXPLÍCITO, nunca por posição — o
// array pode vir menor, fora de ordem ou vazio sem desalinhar as linhas. ──
export function mapEnriquecimento(
  enriquecimento: EnriquecimentoLinha[],
): Map<number, EnriquecimentoLinha> {
  return new Map(enriquecimento.map((e) => [e.indice, e]))
}

// ── Proposta EFETIVA de um pagamento_fatura — colapsa os casos degenerados num
// resultado que a UI renderiza sem ifs espalhados:
// - `confirmavel`: há candidatas para o usuário confirmar (radio se > 1);
// - `fora`: a linha não pode ser importada (sem_match, sem proposta, proposta
//   sem candidata, status desconhecido) — card cinza read-only com o motivo.
//   `known=false` marca status fora da união: selo neutro humanizado, sem
//   afirmar um estado conhecido. ──
export type PropostaEfetiva =
  | { kind: 'confirmavel'; candidatas: FaturaCandidata[] }
  | { kind: 'fora'; motivo: string; known: boolean; status: string }

export function resolverProposta(enr: EnriquecimentoLinha | undefined): PropostaEfetiva {
  const proposta = enr?.fatura_proposta
  if (!proposta) {
    return {
      kind: 'fora',
      motivo: 'O servidor não retornou uma proposta para esta linha.',
      known: true,
      status: 'sem_match',
    }
  }
  switch (proposta.status) {
    case 'match_unico':
    case 'ambiguo':
      if (proposta.candidatas.length > 0) {
        return { kind: 'confirmavel', candidatas: proposta.candidatas }
      }
      // não deveria acontecer (o backend garante ≥1) — degrada em vez de quebrar
      return {
        kind: 'fora',
        motivo: 'A proposta veio sem faturas candidatas.',
        known: true,
        status: proposta.status,
      }
    case 'sem_match':
      return {
        kind: 'fora',
        motivo: proposta.motivo ?? 'Nenhuma fatura correspondente encontrada.',
        known: true,
        status: 'sem_match',
      }
    default:
      return {
        kind: 'fora',
        motivo: proposta.motivo ?? 'Situação não reconhecida — esta linha não será importada.',
        known: false,
        status: proposta.status,
      }
  }
}

// ── Default de `importar` por linha (a regra central, aplicada no PREVIEW_OK):
// receita flagada como recorrência nasce DESMARCADA (armadilha do salário);
// pagamento só nasce marcado quando há candidata confirmável; balde desconhecido
// fica de fora (neutro não importa o que não entende). ──
export function defaultImportar(
  linha: LinhaExtrato,
  enr: EnriquecimentoLinha | undefined,
): boolean {
  switch (linha.balde) {
    case 'receita':
      return !enr?.provavel_recorrencia
    case 'debito':
      return true
    case 'pagamento_fatura':
      return resolverProposta(enr).kind === 'confirmavel'
    default:
      return false
  }
}

// Sugestão de período quando o extrato não o imprime (o commit o exige): a
// menor/maior data das linhas — ISO ordena lexicograficamente. Só sugestão,
// o usuário edita.
export function sugerirPeriodo(preview: ExtratoPreviewResponse): { de: string; ate: string } {
  const datas = preview.extrato.linhas.map((l) => l.data).sort()
  return { de: datas[0] ?? '', ate: datas[datas.length - 1] ?? '' }
}

export const plural = (n: number, sing: string, plur: string) =>
  `${n} ${n === 1 ? sing : plur}`
