import api from './api'

export interface CategoriaStats {
  categoria: string
  total: number
  percentual: number
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
