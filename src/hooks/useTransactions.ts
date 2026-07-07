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

// mes/ano podem ser null enquanto o Dashboard espera o /default-month resolver —
// nesse caso a query fica desabilitada.
export function useTransactions(mes: number | null, ano: number | null) {
  return useQuery({
    queryKey: ['transactions', mes, ano],
    queryFn: () => getTransactions(mes as number, ano as number),
    enabled: mes != null && ano != null,
  })
}

export function useDeleteTransaction(mes: number, ano: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteTransaction(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions', mes, ano] })
      qc.invalidateQueries({ queryKey: ['statistics', 'monthly', mes, ano] })
      // FE-12: fatura/uso de cartão e compromissos dependem das transações
      qc.invalidateQueries({ queryKey: ['cards'] })
      qc.invalidateQueries({ queryKey: ['invoices'] })
      qc.invalidateQueries({ queryKey: ['invoice-detail'] })
      qc.invalidateQueries({ queryKey: ['installments'] })
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
      // FE-12: fatura/uso de cartão e compromissos dependem das transações
      qc.invalidateQueries({ queryKey: ['cards'] })
      qc.invalidateQueries({ queryKey: ['invoices'] })
      qc.invalidateQueries({ queryKey: ['invoice-detail'] })
      qc.invalidateQueries({ queryKey: ['installments'] })
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
      // FE-12: fatura/uso de cartão e compromissos dependem das transações
      qc.invalidateQueries({ queryKey: ['cards'] })
      qc.invalidateQueries({ queryKey: ['invoices'] })
      qc.invalidateQueries({ queryKey: ['invoice-detail'] })
      qc.invalidateQueries({ queryKey: ['installments'] })
      useUIStore.getState().addToast({ message: 'Transação adicionada com sucesso', type: 'success' })
    },
  })
}
