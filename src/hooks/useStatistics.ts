import { useQuery } from '@tanstack/react-query'
import { getMonthlyStats } from '../services/statistics'

export function useMonthlyStats(mes: number, ano: number) {
  return useQuery({
    queryKey: ['statistics', 'monthly', mes, ano],
    queryFn: () => getMonthlyStats(mes, ano),
  })
}
