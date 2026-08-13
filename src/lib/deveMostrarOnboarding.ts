import type { Card } from '../services/cards'
import type { CoverageResponse } from '../services/statistics'

// Quando o guia de primeiros passos aparece no Dashboard.
//
// Está aqui, fora do OverviewPage, porque ESTA metade foi o defeito: a condição
// antiga era `transactions.length === 0 && cards.length === 0` — as DUAS —, e
// cadastrar o cartão (o PASSO 1) derrubava o banner, então os passos 2 e 3 nunca
// apareceram para ninguém. Um `&&` no lugar de um `||` não aparece em revisão de
// diff nem em screenshot; aparece numa tabela de quatro linhas.
//
// Os dois sinais chegam prontos e são independentes: `cards` é global, e o
// histórico vem de `/statistics/coverage` (meses com dados, sem parâmetro de mês).
// Nada aqui olha o mês corrente — foi o outro furo da versão antiga, que usava
// `transactions` do mês e acusava de novato quem importou seis meses de extrato e
// não lançou nada em agosto.

// Cartão DESATIVADO não conta: o passo 1 existe para destravar o passo 2, e a
// importação de fatura só aceita cartão ativo (ImportFaturaPage filtra `c.ativo`).
// Um ✓ que não destrava nada é mentira.
export function temCartaoAtivo(cards: readonly Pick<Card, 'ativo'>[]): boolean {
  return cards.some((c) => c.ativo)
}

export function temHistorico(coverage: CoverageResponse | undefined): boolean {
  return (coverage?.meses_com_dados ?? 0) > 0
}

export function deveMostrarOnboarding(
  cards: readonly Pick<Card, 'ativo'>[],
  coverage: CoverageResponse | undefined,
  isLoading: boolean,
): boolean {
  // Sem resposta — carregando OU erro — não decide. "Não tem histórico" seria
  // chute, e o chute errado trata usuário veterano como novato A CADA load do
  // Dashboard. Calado é o lado recuperável: o guia continua alcançável pelas
  // telas, enquanto o banner indevido não tem como se desfazer.
  if (isLoading || coverage === undefined) return false

  // Fica de pé ENQUANTO houver passo em aberto. Some sozinho quando os dois
  // estão feitos, e volta depois do "Começar do zero", que zera o coverage.
  return !temCartaoAtivo(cards) || !temHistorico(coverage)
}
