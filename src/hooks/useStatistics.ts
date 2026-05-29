import { useQuery, useQueries } from '@tanstack/react-query'
import {
  getMonthlyStats,
  getYearlyStats,
  getCategoryStats,
} from '../services/statistics'

export function useMonthlyStats(mes: number, ano: number) {
  return useQuery({
    queryKey: ['statistics', 'monthly', mes, ano],
    queryFn: () => getMonthlyStats(mes, ano),
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
