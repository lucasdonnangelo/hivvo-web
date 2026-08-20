import type {
  CompetenciaFatura,
  EnriquecimentoFaturaLinha,
  FaturaCommit,
  FaturaCommitRequest,
  FaturaPreviewResponse,
  TransacaoCommit,
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

// Edições do usuário na tela de revisão — o subconjunto de State (ImportFaturaPage)
// que buildFaturaPayload precisa. Tipo próprio (em vez de importar State) para não
// criar dependência de volta para o componente.
export interface EdicoesFatura {
  categorias: Record<number, string>
  apagadas: Record<number, true>
  passadasPagas: Record<string, boolean>
}

// ── Monta o payload do commit ── EXTRAÍDO de dentro de ImportFaturaPage (era um
// closure sobre `state`) para ser uma função PURA e IMPORTÁVEL — o harness de
// dev/ precisa chamar a mesma função que a produção chama, não uma cópia da
// lógica, e um closure sobre o componente inteiro arrastaria useCards/
// useCategories/axios/interceptor de auth para o grafo do harness. Só tipos
// (import type) entram aqui, igual ao resto deste arquivo — comportamento
// idêntico ao que vivia no componente, nenhuma mudança de lógica.
//
// A fatura INTEIRA volta (menos linhas apagadas), categoria por linha. As
// linhas cinzas (pagamento/ajuste/estorno) VIAJAM — o backend as filtra e conta
// estornos_importados/excluidos a partir delas.
//
// TRI-ESTADO da categoria: só vai string quando o usuário MEXEU no seletor.
// Vale para despesa E estorno — os dois têm seletor (#43; o de estorno vive na
// seção "Entram como crédito", mesmo categoriaOptions de despesa). Pagamento/
// ajuste/valor-zero não têm seletor nenhum e vão sempre `null` — não têm
// categoria a decidir porque não materializam.
//
// Linha intocada vai `null` e o servidor recomputa a sugestão — a tela PROPÕE,
// o servidor DECIDE de novo. Mandar de volta o que está na tela pareceria mais
// direto, mas transformaria a proposta do servidor em decisão do usuário.
export function buildFaturaPayload(
  preview: FaturaPreviewResponse,
  edicoes: EdicoesFatura,
): FaturaCommitRequest {
  const transacoes: TransacaoCommit[] = preview.fatura.transacoes
    .map((t, idx) => ({ t, idx }))
    .filter(({ idx }) => !edicoes.apagadas[idx])
    .map(({ t, idx }) => ({
      ...t,
      categoria: isDespesaLinha(t) || isEstornoLinha(t) ? edicoes.categorias[idx] ?? null : null,
    }))
  const fatura: FaturaCommit = { ...preview.fatura, transacoes }
  const competencias_pagas: CompetenciaFatura[] = preview.faturas_passadas
    .filter((p) => !p.ja_paga && edicoes.passadasPagas[`${p.mes}-${p.ano}`])
    .map((p) => ({ mes: p.mes, ano: p.ano }))
  return { cartao_id: preview.cartao_id, fatura, competencias_pagas }
}
