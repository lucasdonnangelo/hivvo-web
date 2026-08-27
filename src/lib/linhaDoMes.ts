import type { MonthlyStats } from '../services/statistics'

/**
 * A linha de topo da Visão geral — os cinco números do Bloco 1.
 *
 * Existe como função PURA, fora do componente, porque foi a topologia que
 * deixou o defeito passar: o hivvo-web não tem teste de componente nem runner
 * de mutação, então regra de negócio dentro do JSX é regra sem portão. Aqui ela
 * tem teste (linhaDoMes.test.ts), e o teste da CADEIA é o que guarda a classe
 * inteira de bug.
 *
 * O DEFEITO QUE ISTO CONSERTA. A linha antiga tinha quatro cards
 * (Receitas · Despesas · A pagar · Saldo) e NENHUM par deles produzia o Saldo:
 *
 *     Receitas 11.000,00 − Despesas  9.590,00 =  1.410,00  ≠ Saldo
 *     Receitas 11.000,00 − A pagar     362,50 = 10.637,50  ≠ Saldo
 *     Saldo real ................................ 9.597,50
 *
 * Porque "Despesas" mostrava `consumo.despesas` (o que se COMPROU no mês) e o
 * Saldo é `receitas − despesas` com `despesas` de FLUXO (o que SAI do mês) —
 * 1.402,50, um número que não estava na tela. O Saldo tinha um operando
 * invisível.
 *
 * Causa histórica: o PLANO_DASHBOARD_DOIS_BLOCOS fixou SALDO = Receitas −
 * A pagar, e sob AQUELA definição a linha fechava. O DECISAO_A_PAGAR_SALDO,
 * posterior, redefiniu o Saldo para incluir o que já saiu — tornou o número
 * mais correto e derrubou a premissa aritmética do layout. Ninguém voltou ao
 * layout.
 */
export interface LinhaDoMes {
  /** Entradas do mês (fluxo). */
  receitas: number
  /** Tudo que SAI do caixa no mês (fluxo integral). O subtraendo do saldo. */
  saidas: number
  /** Resultado do mês: receitas − saidas. */
  saldo: number
  /** Parte de `saidas` cujo dia já passou (§1.3.1, eixo TEMPO). */
  saiu: number
  /** Parte de `saidas` cujo dia ainda não chegou (§1.3.1, eixo TEMPO). */
  aindaSai: number
  /**
   * A decomposição saiu/aindaSai veio do backend?
   *
   * False quando `realizado`/`a_vir` faltam na resposta (contrato antigo). Aí a
   * cadeia é preservada por fallback (`saiu = saidas`), o que seria uma MENTIRA
   * se exibido num mês corrente — então o componente esconde a sublinha em vez
   * de afirmar que tudo já saiu.
   */
  temDecomposicao: boolean
}

/**
 * Deriva a linha do mês a partir da resposta de /statistics/monthly.
 *
 * REGRA DE FONTE — cada campo vem do seu lugar, e nenhum é recalculado a partir
 * dos outros. É de propósito: se `saldo` fosse derivado como `receitas -
 * saidas`, o teste da cadeia fecharia sozinho e não guardaria nada. Lendo as
 * três fontes de forma independente, trocar a fonte de qualquer uma (por
 * exemplo apontar `saidas` de volta para `consumo.despesas`) deixa o teste
 * VERMELHO. É esse o portão.
 *
 *     receitas  ← stats.receitas          (fluxo)
 *     saidas    ← stats.despesas          (fluxo — NUNCA consumo.despesas)
 *     saldo     ← stats.saldo             (o backend calcula receitas − despesas)
 *     saiu      ← stats.realizado.despesas
 *     aindaSai  ← stats.a_vir.despesas    (NUNCA a_pagar — ver abaixo)
 *
 * POR QUE `aindaSai` NÃO É `a_pagar`. São eixos diferentes, e o schema do
 * backend diz isso explicitamente: `a_pagar` é o eixo DÍVIDA-DE-CRÉDITO (só
 * crédito cuja saída não ocorreu, válido para qualquer mês); `a_vir` é o eixo
 * TEMPO-NO-MÊS-CORRENTE (dia > hoje). Uma parcela vencida e não confirmada paga
 * conta em `realizado` E em `a_pagar` — contada duas vezes —, então
 * `realizado + a_pagar` não fecha com `despesas`. Medido: com R$ 1.040,00
 * vencendo dia 10 e R$ 362,50 dia 25, em 15/07, `a_pagar` vale 1.402,50 (a
 * despesa inteira) enquanto `a_vir` vale 362,50. Os dois coincidem só quando o
 * que já saiu é à vista/PIX/recorrência, que nunca é `a_pagar` — coincidência
 * de dataset, não invariante.
 *
 * Tolera campos ausentes sem devolver NaN e SEM quebrar a cadeia: quando só uma
 * metade da decomposição existe, a outra é completada por diferença.
 */
export function derivarLinhaDoMes(
  stats: Pick<MonthlyStats, 'receitas' | 'despesas' | 'saldo'> &
    Partial<Pick<MonthlyStats, 'realizado' | 'a_vir'>>,
): LinhaDoMes {
  const receitas = num(stats?.receitas)
  const saidas = num(stats?.despesas)
  const saldo = num(stats?.saldo)

  const temRealizado = ehNumero(stats?.realizado?.despesas)
  const temAVir = ehNumero(stats?.a_vir?.despesas)
  const temDecomposicao = temRealizado || temAVir

  // Completar por diferença mantém `saiu + aindaSai === saidas` mesmo com meia
  // decomposição. Sem nenhuma das duas, tudo cai em `saiu` (e a flag manda
  // esconder a sublinha, porque num mês corrente isso seria falso).
  const saiu = temRealizado
    ? num(stats.realizado?.despesas)
    : saidas - num(stats?.a_vir?.despesas)
  const aindaSai = temAVir ? num(stats.a_vir?.despesas) : saidas - saiu

  return { receitas, saidas, saldo, saiu, aindaSai, temDecomposicao }
}

/**
 * O campo veio com um número utilizável?
 *
 * Aceita STRING numérica, e não é frouxidão: o backend serializa `Decimal` como
 * string JSON ("6200.00"), e é `services/statistics.parseMonthly` que converte.
 * Quem chamar esta função com o payload cru — o harness semeia o cache do
 * TanStack com a resposta capturada, sem passar pelo parse — receberia ZERO em
 * silêncio se aqui fosse `typeof v === 'number'`. Foi o que aconteceu na
 * primeira medição: a linha inteira renderizou R$ 0,00 e a sublinha sumiu.
 */
function ehNumero(v: unknown): v is number | string {
  if (typeof v === 'number') return Number.isFinite(v)
  if (typeof v === 'string' && v.trim() !== '') return Number.isFinite(Number(v))
  return false
}

/** Campo ausente/inválido vale zero — a linha nunca imprime NaN. */
function num(v: unknown): number {
  return ehNumero(v) ? Number(v) : 0
}
