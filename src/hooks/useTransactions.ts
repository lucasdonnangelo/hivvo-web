import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createTransaction,
  deleteTransaction,
  getTransactions,
  updateTransaction,
  type Transaction,
  type TransactionCreatePayload,
} from '../services/transactions'
import { useUIStore } from '../store/uiStore'

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
      useUIStore.getState().addToast({ message: 'Transação removida', type: 'success' })
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
      useUIStore.getState().addToast({ message: 'Transação atualizada', type: 'success' })
    },
  })
}

export function useCreateTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: TransactionCreatePayload) => createTransaction(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: ['statistics', 'monthly'] })
      useUIStore.getState().addToast({ message: 'Transação adicionada com sucesso', type: 'success' })
    },
  })
}
