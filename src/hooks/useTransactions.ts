import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  deleteTransaction,
  getTransactions,
  updateTransaction,
  type Transaction,
} from '../services/transactions'

export function useTransactions(mes: number, ano: number) {
  return useQuery({
    queryKey: ['transactions', mes, ano],
    queryFn: () => getTransactions(mes, ano),
  })
}

export function useDeleteTransaction(mes: number, ano: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteTransaction(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions', mes, ano] })
      qc.invalidateQueries({ queryKey: ['statistics', 'monthly', mes, ano] })
    },
  })
}

export function useUpdateTransaction(mes: number, ano: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number
      payload: Partial<Omit<Transaction, 'id'>>
    }) => updateTransaction(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions', mes, ano] })
      qc.invalidateQueries({ queryKey: ['statistics', 'monthly', mes, ano] })
    },
  })
}
