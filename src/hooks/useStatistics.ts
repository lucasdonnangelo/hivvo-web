import { useQuery, useQueries } from '@tanstack/react-query'
import {
  getMonthlyStats,
  getYearlyStats,
  getCategoryStats,
  getProjection,
  getCoverage,
  getHighlights,
} from '../services/statistics'
import type { CategoriaStats } from '../services/statistics'

// mes/ano podem ser null enquanto o Dashboard espera o /default-month resolver —
// nesse caso a query fica desabilitada (não dispara /monthly com mês indefinido).
export function useMonthlyStats(mes: number | null, ano: number | null) {
  return useQuery({
    queryKey: ['statistics', 'monthly', mes, ano],
    queryFn: () => getMonthlyStats(mes as number, ano as number),
    enabled: mes != null && ano != null,
  })
}

// Projeção do Bloco 2 do Dashboard (server-state): 12 meses de fluxo à frente,
// já começando no mês default (series[0]). Query independente do /monthly.
export function useProjection(meses = 12) {
  return useQuery({
    queryKey: ['statistics', 'projection', meses],
    queryFn: () => getProjection(meses),
  })
}

// Florescimento da aba Análise: nº de meses distintos com dados. Decide quais
// seções temporais renderizam (≥2 → Comparação; ≥3 → Evolução). Sem parâmetros.
export function useCoverage() {
  return useQuery({
    queryKey: ['statistics', 'coverage'],
    queryFn: () => getCoverage(),
  })
}

// Destaques do mês (Resumo/Seção 1). Mesmo mês do Dashboard → convive no cache
// com o /monthly sem drift.
export function useHighlights(mes: number, ano: number) {
  return useQuery({
    queryKey: ['statistics', 'highlights', mes, ano],
    queryFn: () => getHighlights(mes, ano),
  })
}

export function useYearlyStats(ano: number) {
  return useQuery({
    queryKey: ['statistics', 'yearly', ano],
    queryFn: () => getYearlyStats(ano),
  })
}

export function useCategoryStats(params: { mes?: number; ano: number }) {
  return useQuery({
    queryKey: ['statistics', 'categories', params.mes, params.ano],
    queryFn: () => getCategoryStats(params),
  })
}

// Fetches all 12 months and aggregates category breakdown client-side,
// so the Ano view never depends on /statistics/categories (which is month-scoped).
export function useAnnualCategoryStats(ano: number) {
  const queries = useQueries({
    queries: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => ({
      queryKey: ['statistics', 'monthly', m, ano],
      queryFn: () => getMonthlyStats(m, ano),
    })),
  })

  const isLoading = queries.some((q) => q.isLoading)
  const allData = queries.map((q) => q.data).filter(Boolean)

  if (isLoading || allData.length === 0) {
    return { isLoading, data: undefined }
  }

  const totalDespesas = allData.reduce((sum, d) => sum + (d?.despesas ?? 0), 0)

  const catMap = new Map<string, number>()
  for (const d of allData) {
    for (const cat of d?.categorias ?? []) {
      catMap.set(cat.categoria, (catMap.get(cat.categoria) ?? 0) + cat.total)
    }
  }

  const categorias: CategoriaStats[] = [...catMap.entries()]
    .map(([categoria, total]) => ({
      categoria,
      total,
      percentual: totalDespesas > 0 ? (total / totalDespesas) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total)

  return { isLoading, data: { categorias } }
}

// Fetches 3 months for a quarter and aggregates them client-side
export function useQuarterlyStats(quarterStartMes: number, ano: number) {
  const months = [quarterStartMes, quarterStartMes + 1, quarterStartMes + 2]

  const queries = useQueries({
    queries: months.map((m) => ({
      queryKey: ['statistics', 'monthly', m, ano],
      queryFn: () => getMonthlyStats(m, ano),
    })),
  })

  const isLoading = queries.some((q) => q.isLoading)
  const isError = queries.some((q) => q.isError)
  const allData = queries.map((q) => q.data).filter(Boolean)

  if (isLoading || allData.length === 0) {
    return { isLoading, isError, data: undefined, queries }
  }

  const receitas = allData.reduce((sum, d) => sum + (d?.receitas ?? 0), 0)
  const despesas = allData.reduce((sum, d) => sum + (d?.despesas ?? 0), 0)
  const saldo = receitas - despesas

  // Merge and recalculate categories across the 3 months
  const catMap = new Map<string, number>()
  for (const d of allData) {
    for (const cat of d?.categorias ?? []) {
      catMap.set(cat.categoria, (catMap.get(cat.categoria) ?? 0) + cat.total)
    }
  }
  const categorias = [...catMap.entries()]
    .map(([categoria, total]) => ({
      categoria,
      total,
      percentual: despesas > 0 ? (total / despesas) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total)

  return {
    isLoading,
    isError,
    data: { receitas, despesas, saldo, categorias },
    queries,
  }
}
