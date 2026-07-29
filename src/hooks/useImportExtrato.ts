import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  commitExtrato,
  previewExtrato,
  type ExtratoCommitRequest,
} from '../services/importExtrato'

// Preview é STATELESS (não grava nada) → sem invalidação de cache; é só uma
// mutation porque envia arquivo e o resultado não é server-state cacheável.
export function usePreviewExtrato() {
  return useMutation({
    mutationFn: (arquivo: File) => previewExtrato(arquivo),
  })
}

// Commit ESCREVE: cria receitas/débitos e registra pagamentos de fatura com o
// valor REAL (pode virar paga_parcial). Invalida tudo que essa escrita move.
// Sem `installments`: extrato não cria parcela. Sem toast: a tela de recibo é a
// confirmação (mostra as contagens que o toast truncaria).
export function useCommitExtrato() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: ExtratoCommitRequest) => commitExtrato(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: ['statistics'] })
      qc.invalidateQueries({ queryKey: ['cards'] })
      qc.invalidateQueries({ queryKey: ['invoices'] })
      qc.invalidateQueries({ queryKey: ['invoice-detail'] })
      qc.invalidateQueries({ queryKey: ['competencia-faturas'] })
    },
  })
}
