import api from './api'

export interface CategoriaStats {
  categoria: string
  total: number
  percentual: number
}

// Uma leitura do mês corrente pelo dia de hoje (§1.3.1): realizado (dia <= hoje)
// ou a-vir (dia > hoje). Em mês não-corrente: realizado == projeção, a_vir zerado.
export interface LeituraMes {
  receitas: number
  despesas: number
  saldo: number
}

export interface MonthlyStats {
  mes: number
  ano: number
  receitas: number
  despesas: number
  saldo: number
  // FLUXO estrito "a pagar" (Bloco 1 do Dashboard): só o que VENCE e ainda NÃO
  // saiu — crédito a vencer. À vista/PIX/recorrência (que saem por competência do
  // mês) ficam FORA. Distinto de `despesas` (fluxo integral do mês). Exclusivo do
  // Bloco 1; ver a nota em ProjectionMonth sobre por que o Bloco 2 NÃO usa este campo.
  a_pagar: number
  variacao_receitas: number | null
  variacao_despesas: number | null
  variacao_saldo?: number | null
  categorias: CategoriaStats[]
  // Decomposição do mês corrente (aditivo; o topo continua sendo a projeção).
  realizado: LeituraMes
  a_vir: LeituraMes
  // Fase 3b — leitura de CONSUMO (regime de caixa): despesa/saldo distintos do
  // fluxo (topo); receita é idêntica. Opcionais: o backend 3b está commitado mas
  // pode não estar no ar ainda, então a resposta pode não trazer estes campos.
  consumo?: LeituraMes
  categorias_consumo?: CategoriaStats[]
}

export interface MesEvolucao {
  mes: number
  ano: number
  receitas: number
  despesas: number
  saldo: number
}

export interface AnualResponse {
  ano: number
  meses: MesEvolucao[]
}

export interface CategoriasResponse {
  categorias: CategoriaStats[]
  total_despesas: number
}

// Projeção do Dashboard (Bloco 2 "Sua projeção"): 12 meses à frente de fluxo.
// series[0] = 1º mês FUTURO com fluxo (o backend nunca devolve o mês corrente
// aqui) — o card "Em destaque"; series[1..] = próximos meses.
//
// Campos = fluxo. O Bloco 2 exibe `despesas` (fluxo INTEGRAL do mês) sob o rótulo
// "a pagar" — NÃO o `a_pagar` estrito, embora ambos existam no contrato. Razão
// (sutileza que parece inconsistência à primeira vista): o eixo "já saiu vs. a
// vencer" só existe no MÊS CORRENTE. No futuro nada saiu ainda, então fluxo
// integral == tudo a pagar. Usar o `a_pagar` estrito (que exclui recorrência/PIX/
// à vista) esconderia aluguel/assinaturas e quebraria a aritmética do saldo
// (saldo = receitas − despesas). O `a_pagar` estrito é exclusivo do Bloco 1, onde
// convive com o card DESPESAS e o mês corrente tem a distinção realizado/a-vir.
export interface ProjectionMonth {
  mes: number
  ano: number
  receitas: number
  despesas: number
  a_pagar: number
  saldo: number
}

export interface ProjectionResponse {
  series: ProjectionMonth[]
}

// Florescimento do Resumo/Análise: nº de meses distintos com dados no histórico
// do usuário. Governa quais seções temporais aparecem (≥2 → Comparação; ≥3 →
// Evolução). Sem parâmetros — é o histórico inteiro.
export interface CoverageResponse {
  meses_com_dados: number
}

// Destaques do mês (Resumo/Seção 1 "Este mês em detalhe"). Base CONSUMO, mês
// corrente. Único endpoint não-temporal do Resumo.
export interface MaiorDespesa {
  valor: number
  descricao: string
  categoria: string
  data: string
}

export interface DiaMaiorGasto {
  data: string
  total: number
}

export interface HighlightsResponse {
  // Ambos null em mês sem despesa (só receitas, ou mês vazio).
  maior_despesa: MaiorDespesa | null
  dia_maior_gasto: DiaMaiorGasto | null
  // nº de movimentações DECOMPOSTO (aditivo): total = lançadas + recorrentes.
  num_transacoes_total: number
  num_lancadas: number
  num_recorrentes: number
}

// Comparação (Resumo/Seção 2). Mês atual vs anterior vs média dos meses FECHADOS.
// Base CONSUMO. Variação % via _variacao no backend: null quando a base (anterior/
// média) é zero — ex.: categoria que surgiu (nunca "+∞"); categoria que sumiu → −100%.
export interface VariacaoTripla {
  receitas: number | null
  despesas: number | null
  saldo: number | null
}

export interface TotaisComparacao {
  atual: LeituraMes
  anterior: LeituraMes
  media: LeituraMes
  variacao_vs_anterior: VariacaoTripla
  variacao_vs_media: VariacaoTripla
}

export interface CategoriaComparacao {
  categoria: string
  atual: number
  anterior: number
  media: number
  variacao_vs_anterior: number | null
  variacao_vs_media: number | null
}

export interface ComparacaoResponse {
  mes: number
  ano: number
  totais: TotaisComparacao
  categorias: CategoriaComparacao[] // só despesas, ordenadas por atual desc
}

// Evolução (Resumo/Seção 3). Série CONSUMO dos últimos N meses — o espelho pra
// trás do /projection. Cronológica: series[0] = mês mais antigo, series[-1] = o
// corrente (âncora, PARCIAL). Contínua: mês sem dado entra com zeros.
export interface MesEvolucaoConsumo {
  mes: number
  ano: number
  receitas: number
  despesas: number
  saldo: number
}

export interface EvolucaoResponse {
  series: MesEvolucaoConsumo[]
}

// Gasto por categoria mês a mês (categoria-major): cada `serie` alinhada por
// ÍNDICE ao eixo `meses` (0 nos meses sem gasto). Categorias por total desc.
export interface SerieCategoria {
  categoria: string
  total: number
  serie: number[]
}

export interface EvolucaoCategoriasResponse {
  meses: MesAno[]
  categorias: SerieCategoria[]
}

interface MesAno {
  mes: number
  ano: number
}

// Consumo por cartão do mês (Resumo/Seção 1). Base CONSUMO, DESPESA-only — a
// MESMA lista do donut de categorias (fonte única no backend). Distinto de
// FATURA (o que vence, na lente 3d de Cartões): aqui é o que foi GASTO no mês.
// `cartoes` já vem ordenado por total desc; `sem_cartao` (PIX/à vista +
// recorrências, cartao_id nulo) é campo SEPARADO — `cartoes` não traz item nulo.
// Invariante do backend: sum(cartoes) + sem_cartao == total == consumo.despesas
// do /monthly. Mês sem despesa → cartoes=[], sem_cartao=0, total=0.
export interface GastoCartaoItem {
  cartao_id: number
  cartao_nome: string
  total: number
}

export interface GastoPorCartaoResponse {
  mes: number
  ano: number
  cartoes: GastoCartaoItem[]
  sem_cartao: number
  total: number
}

// ── parsers: backend returns Decimal fields as strings ─────────────────────────

function parseCat(c: CategoriaStats): CategoriaStats {
  return { ...c, total: Number(c.total), percentual: Number(c.percentual) }
}

function parseLeitura(l: LeituraMes): LeituraMes {
  return {
    receitas: Number(l.receitas),
    despesas: Number(l.despesas),
    saldo: Number(l.saldo),
  }
}

function parseMonthly(d: MonthlyStats): MonthlyStats {
  return {
    ...d,
    receitas: Number(d.receitas),
    despesas: Number(d.despesas),
    saldo: Number(d.saldo),
    a_pagar: Number(d.a_pagar),
    variacao_receitas: d.variacao_receitas != null ? Number(d.variacao_receitas) : null,
    variacao_despesas: d.variacao_despesas != null ? Number(d.variacao_despesas) : null,
    variacao_saldo: d.variacao_saldo != null ? Number(d.variacao_saldo) : null,
    categorias: d.categorias.map(parseCat),
    realizado: parseLeitura(d.realizado),
    a_vir: parseLeitura(d.a_vir),
    consumo: d.consumo ? parseLeitura(d.consumo) : undefined,
    categorias_consumo: d.categorias_consumo?.map(parseCat),
  }
}

function parseYearly(d: AnualResponse): AnualResponse {
  return {
    ...d,
    meses: d.meses.map((m) => ({
      ...m,
      receitas: Number(m.receitas),
      despesas: Number(m.despesas),
      saldo: Number(m.saldo),
    })),
  }
}

function parseCategories(d: CategoriasResponse): CategoriasResponse {
  return {
    ...d,
    total_despesas: Number(d.total_despesas),
    categorias: d.categorias.map(parseCat),
  }
}

function parseProjectionMonth(m: ProjectionMonth): ProjectionMonth {
  return {
    mes: m.mes,
    ano: m.ano,
    receitas: Number(m.receitas),
    despesas: Number(m.despesas),
    a_pagar: Number(m.a_pagar),
    saldo: Number(m.saldo),
  }
}

// Parser tolerante: Decimal→Number nos valores; objetos ausentes viram null;
// contagens ausentes caem para 0. Blinda a UI se o backend omitir um campo.
function parseHighlights(d: HighlightsResponse): HighlightsResponse {
  return {
    maior_despesa: d.maior_despesa
      ? { ...d.maior_despesa, valor: Number(d.maior_despesa.valor) }
      : null,
    dia_maior_gasto: d.dia_maior_gasto
      ? { ...d.dia_maior_gasto, total: Number(d.dia_maior_gasto.total) }
      : null,
    num_transacoes_total: Number(d.num_transacoes_total ?? 0),
    num_lancadas: Number(d.num_lancadas ?? 0),
    num_recorrentes: Number(d.num_recorrentes ?? 0),
  }
}

// Variações preservam null (base zero → sem variação); demais campos Decimal→Number.
function parseVariacaoTripla(v: VariacaoTripla): VariacaoTripla {
  return {
    receitas: v.receitas != null ? Number(v.receitas) : null,
    despesas: v.despesas != null ? Number(v.despesas) : null,
    saldo: v.saldo != null ? Number(v.saldo) : null,
  }
}

function parseComparacao(d: ComparacaoResponse): ComparacaoResponse {
  return {
    mes: d.mes,
    ano: d.ano,
    totais: {
      atual: parseLeitura(d.totais.atual),
      anterior: parseLeitura(d.totais.anterior),
      media: parseLeitura(d.totais.media),
      variacao_vs_anterior: parseVariacaoTripla(d.totais.variacao_vs_anterior),
      variacao_vs_media: parseVariacaoTripla(d.totais.variacao_vs_media),
    },
    categorias: d.categorias.map((c) => ({
      categoria: c.categoria,
      atual: Number(c.atual),
      anterior: Number(c.anterior),
      media: Number(c.media),
      variacao_vs_anterior: c.variacao_vs_anterior != null ? Number(c.variacao_vs_anterior) : null,
      variacao_vs_media: c.variacao_vs_media != null ? Number(c.variacao_vs_media) : null,
    })),
  }
}

function parseEvolucao(d: EvolucaoResponse): EvolucaoResponse {
  return {
    series: d.series.map((m) => ({
      mes: m.mes,
      ano: m.ano,
      receitas: Number(m.receitas),
      despesas: Number(m.despesas),
      saldo: Number(m.saldo),
    })),
  }
}

function parseEvolucaoCategorias(d: EvolucaoCategoriasResponse): EvolucaoCategoriasResponse {
  return {
    meses: d.meses.map((m) => ({ mes: m.mes, ano: m.ano })),
    categorias: d.categorias.map((c) => ({
      categoria: c.categoria,
      total: Number(c.total),
      serie: c.serie.map(Number),
    })),
  }
}

function parseGastoPorCartao(d: GastoPorCartaoResponse): GastoPorCartaoResponse {
  return {
    mes: d.mes,
    ano: d.ano,
    cartoes: d.cartoes.map((c) => ({
      cartao_id: c.cartao_id,
      cartao_nome: c.cartao_nome,
      total: Number(c.total),
    })),
    sem_cartao: Number(d.sem_cartao),
    total: Number(d.total),
  }
}

// ── API calls ──────────────────────────────────────────────────────────────────

export const getMonthlyStats = (mes: number, ano: number) =>
  api
    .get<MonthlyStats>('/statistics/monthly', { params: { mes, ano } })
    .then((r) => parseMonthly(r.data))

export const getYearlyStats = (ano: number) =>
  api
    .get<AnualResponse>('/statistics/yearly', { params: { ano } })
    .then((r) => parseYearly(r.data))

export const getCategoryStats = (params: { mes?: number; ano: number }) =>
  api
    .get<CategoriasResponse>('/statistics/categories', { params })
    .then((r) => parseCategories(r.data))

export const getProjection = (meses = 12) =>
  api
    .get<ProjectionResponse>('/statistics/projection', { params: { meses } })
    .then((r) => ({ series: r.data.series.map(parseProjectionMonth) }))

export const getCoverage = () =>
  api
    .get<CoverageResponse>('/statistics/coverage')
    .then((r) => ({ meses_com_dados: Number(r.data.meses_com_dados) }))

export const getHighlights = (mes: number, ano: number) =>
  api
    .get<HighlightsResponse>('/statistics/highlights', { params: { mes, ano } })
    .then((r) => parseHighlights(r.data))

export const getComparison = (meses = 3) =>
  api
    .get<ComparacaoResponse>('/statistics/comparison', { params: { meses } })
    .then((r) => parseComparacao(r.data))

export const getEvolution = (meses = 6) =>
  api
    .get<EvolucaoResponse>('/statistics/evolution', { params: { meses } })
    .then((r) => parseEvolucao(r.data))

export const getEvolutionCategories = (meses = 6) =>
  api
    .get<EvolucaoCategoriasResponse>('/statistics/evolution/categories', { params: { meses } })
    .then((r) => parseEvolucaoCategorias(r.data))

export const getSpendingByCard = (mes: number, ano: number) =>
  api
    .get<GastoPorCartaoResponse>('/statistics/spending-by-card', { params: { mes, ano } })
    .then((r) => parseGastoPorCartao(r.data))
