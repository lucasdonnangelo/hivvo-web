import type { TransacaoFatura } from '../../../services/importFatura'

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
