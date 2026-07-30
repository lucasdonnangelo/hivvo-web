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

// Só compra/iof COM valor positivo viram despesa (materializam). Espelha
// _TIPOS_GASTO + valor>0 do backend.
export const isDespesaLinha = (t: TransacaoFatura): boolean =>
  (t.tipo === 'compra' || t.tipo === 'iof') && Number(t.valor_brl) > 0

// Compra/iof NEGATIVA é estorno. Não é despesa, mas É IMPORTADA: vira
// `Transacao(tipo="estorno")` e as agregações a SUBTRAEM do consumo (conta em
// `estornos_importados` no recibo). É por isso que ela não pode dividir seção
// com pagamento/ajuste — o destino é o oposto.
//
// `< 0`, e não `<= 0`: o backend materializa compra/iof com valor != 0, então a
// linha de valor EXATAMENTE zero não vira lançamento nenhum e não pode herdar a
// promessa de importação do estorno.
export const isEstornoLinha = (t: TransacaoFatura): boolean =>
  (t.tipo === 'compra' || t.tipo === 'iof') && Number(t.valor_brl) < 0

// Explica UMA linha que não é despesa — dizendo o destino dela, porque as duas
// seções de baixo têm destinos opostos e nenhuma frase de seção fala por todas.
// Pagamento/ajuste_saldo/valor zero VIAJAM no commit e o backend os filtra
// (entram em `excluidos`); o estorno viaja e é GRAVADO.
export const motivoNaoDespesa = (t: TransacaoFatura): string => {
  if (t.tipo === 'pagamento')
    return 'Pagamento da fatura — quita o que já foi gasto, não é um gasto novo.'
  if (t.tipo === 'ajuste_saldo') return 'Ajuste de saldo — não é um gasto.'
  if (isEstornoLinha(t)) return 'Estorno (crédito) — entra abatendo o consumo.'
  // sobra: compra/iof com valor exatamente zero
  return 'Valor zero — não vira lançamento.'
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
