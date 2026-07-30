import type {
  EnriquecimentoFaturaLinha,
  TransacaoFatura,
} from '../../../services/importFatura'

export const formatBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

const MESES_CURTOS = [
  'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
  'jul', 'ago', 'set', 'out', 'nov', 'dez',
]

export const formatCompetencia = (mes: number, ano: number) =>
  `${MESES_CURTOS[mes - 1] ?? '?'}/${ano}`

// Só compra/iof COM valor positivo viram despesa (materializam). Pagamento e
// ajuste_saldo são liquidação/saldo; compra negativa é estorno — ambos ficam na
// seção cinza "não entra como despesa" (mas VIAJAM no commit, que os filtra e
// conta estornos_ignorados/excluidos). Espelha _TIPOS_GASTO + valor>0 do backend.
export const isDespesaLinha = (t: TransacaoFatura): boolean =>
  (t.tipo === 'compra' || t.tipo === 'iof') && Number(t.valor_brl) > 0

export const motivoExclusao = (t: TransacaoFatura): string => {
  if (t.tipo === 'pagamento') return 'Pagamento da fatura — abate o saldo, não é gasto.'
  if (t.tipo === 'ajuste_saldo') return 'Ajuste de saldo — não é um gasto.'
  // sobra: compra/iof com valor <= 0 = estorno (crédito)
  return 'Estorno (crédito) — não entra como despesa.'
}

export const formatParcela = (t: TransacaoFatura): string | null =>
  t.parcela ? `${t.parcela.indice}/${t.parcela.total}` : null

export const formatPortador = (t: TransacaoFatura): string =>
  t.portador_final ? `•••• ${t.portador_final}` : '—'

// Join linhas↔enriquecimento por `indice` EXPLÍCITO, nunca por posição: as
// linhas não-materializáveis (pagamento/ajuste_saldo) não têm item, então
// posição e índice divergem. Gêmeo do mapEnriquecimento do extrato.
export function mapEnriquecimento(
  enriquecimento: EnriquecimentoFaturaLinha[],
): Map<number, EnriquecimentoFaturaLinha> {
  return new Map(enriquecimento.map((e) => [e.indice, e]))
}

// Rótulo da marca de sugestão. Diz QUAL camada propôs, porque as duas frases
// pesam diferente para o usuário: "eu já decidi isso antes" convence mais que
// "o sistema achou". `null` = sem marca (nada foi sugerido, ou o usuário já
// mexeu no seletor — aí a categoria é decisão dele, não proposta).
export const rotuloSugestao = (
  origem: EnriquecimentoFaturaLinha['origem_sugestao'],
): string | null => {
  if (origem === 'historico') return 'como você já categorizou'
  if (origem === 'regra') return 'sugerida'
  return null
}
