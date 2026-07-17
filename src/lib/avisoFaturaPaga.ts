import type { AvisoFaturaPaga, CompetenciaFatura } from '../services/transactions'
import type { Card } from '../services/cards'

// #9 — Compõe a copy do aviso "compra caiu em fatura já paga" a partir da
// estrutura pura do backend. O backend NÃO manda texto de UI; nós montamos aqui
// usando o nome do cartão (resolvido pelo cartao_id) e o mês por extenso.
//
// Honesta ao que o backend faz: o lançamento persistiu, o status da fatura NÃO
// muda e nada é reaberto/recalculado. A frase só avisa que a compra não vai
// aparecer no "A pagar". Não prometemos reabertura nem recálculo.

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

function competenciaPorExtenso(mes: number, ano: number): string {
  // fatura_mes é 1-12; fora do range cai num fallback numérico defensivo.
  const nome = MESES[mes - 1]
  return nome ? `${nome}/${ano}` : `${mes}/${ano}`
}

// Junta "março/2026 e abril/2026" (2) ou "março/2026, abril/2026 e maio/2026" (3+).
function juntar(itens: string[]): string {
  if (itens.length <= 1) return itens[0] ?? ''
  return `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}`
}

function dedupeOrdena(comps: CompetenciaFatura[]): CompetenciaFatura[] {
  const vistos = new Set<string>()
  const unicos: CompetenciaFatura[] = []
  for (const c of comps) {
    const chave = `${c.fatura_ano}-${c.fatura_mes}`
    if (vistos.has(chave)) continue
    vistos.add(chave)
    unicos.push(c)
  }
  return unicos.sort((a, b) => a.fatura_ano - b.fatura_ano || a.fatura_mes - b.fatura_mes)
}

/**
 * Retorna a mensagem do toast do aviso, ou null se não há nada a avisar.
 * `cards` pode estar ausente (cache ainda não carregado) — nesse caso o nome
 * do cartão degrada para "seu cartão", sem inventar.
 */
export function avisoFaturaPagaMessage(
  avisos: AvisoFaturaPaga[],
  cards: Card[] | undefined,
): string | null {
  const competencias = avisos.flatMap((a) => a.competencias)
  if (competencias.length === 0) return null

  const nomePorCartao = new Map<number, string>()
  for (const card of cards ?? []) nomePorCartao.set(card.id, card.nome)

  // Agrupa por cartão. Na prática a transação tem um único cartao_id, então isso
  // rende uma frase só; agrupar mantém a copy correta caso o contrato evolua.
  const porCartao = new Map<number, CompetenciaFatura[]>()
  for (const c of competencias) {
    const lista = porCartao.get(c.cartao_id) ?? []
    lista.push(c)
    porCartao.set(c.cartao_id, lista)
  }

  const frases: string[] = []
  for (const [cartaoId, comps] of porCartao) {
    const nome = nomePorCartao.get(cartaoId) ?? 'seu cartão'
    const meses = dedupeOrdena(comps).map((c) => competenciaPorExtenso(c.fatura_mes, c.fatura_ano))
    frases.push(
      meses.length === 1
        ? `Esta compra caiu na fatura de ${meses[0]} do ${nome}, já marcada como paga. Ela não vai aparecer no 'A pagar'.`
        : `Esta compra caiu nas faturas de ${juntar(meses)} do ${nome}, já marcadas como pagas. Ela não vai aparecer no 'A pagar'.`,
    )
  }
  return frases.join(' ')
}
