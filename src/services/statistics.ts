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
