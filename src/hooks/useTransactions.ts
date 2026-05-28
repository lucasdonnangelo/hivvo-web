import { useQuery } from '@tanstack/react-query'
import { getTransactions } from '../services/transactions'

export function useTransactions(mes: number, ano: number) {
  return useQuery({
    queryKey: ['transactions', mes, ano],
    queryFn: () => getTransactions(mes, ano),
  })
}
