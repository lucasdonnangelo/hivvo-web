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
  categorias: CategoriaStats[]
}

export const getMonthlyStats = (mes: number, ano: number) =>
  api
    .get<MonthlyStats>('/statistics/monthly', { params: { mes, ano } })
    .then((r) => r.data)
