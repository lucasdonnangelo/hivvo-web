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
