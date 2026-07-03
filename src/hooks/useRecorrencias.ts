import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createRecorrencia,
  deleteRecorrencia,
  getRecorrencias,
  updateRecorrencia,
  type RecorrenciaCreate,
  type RecorrenciaUpdate,
} from '../services/recorrencias'
import { useUIStore } from '../store/uiStore'

export function useRecorrencias(incluirEncerradas = false) {
  return useQuery({
    queryKey: ['recorrencias', incluirEncerradas],
    queryFn: () => getRecorrencias(incluirEncerradas),
    staleTime: 5 * 60 * 1000,
  })
}

// Recorrência entra na projeção (Fonte 4). Criar/editar/excluir muda receitas,
// despesas e saldo de qualquer mês do horizonte → invalidar a projeção mensal E
// anual, além do conjunto que o padrão de useTransactions invalida, para o
// Dashboard/Resumo re-buscarem e mostrarem a recorrência na hora.
function invalidateProjecao(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['recorrencias'] })
  qc.invalidateQueries({ queryKey: ['statistics', 'monthly'] })
  qc.invalidateQueries({ queryKey: ['statistics', 'yearly'] })
  qc.invalidateQueries({ queryKey: ['transactions'] })
  qc.invalidateQueries({ queryKey: ['cards'] })
  qc.invalidateQueries({ queryKey: ['invoices'] })
  qc.invalidateQueries({ queryKey: ['invoice-detail'] })
  qc.invalidateQueries({ queryKey: ['installments'] })
}

export function useCreateRecorrencia() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: RecorrenciaCreate) => createRecorrencia(payload),
    onSuccess: () => {
      invalidateProjecao(qc)
      useUIStore.getState().addToast({ message: 'Recorrência criada', type: 'success' })
    },
  })
}

export function useUpdateRecorrencia() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: RecorrenciaUpdate }) =>
      updateRecorrencia(id, payload),
    onSuccess: () => {
      invalidateProjecao(qc)
      useUIStore.getState().addToast({ message: 'Recorrência atualizada', type: 'success' })
    },
  })
}

export function useDeleteRecorrencia() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteRecorrencia(id),
    onSuccess: () => {
      invalidateProjecao(qc)
      useUIStore.getState().addToast({ message: 'Recorrência removida', type: 'success' })
    },
  })
}
