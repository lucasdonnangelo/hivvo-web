import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  commitFatura,
  previewFatura,
  type FaturaCommitRequest,
} from '../services/importFatura'

// Preview é STATELESS (não grava nada) → sem invalidação de cache; é só uma
// mutation porque envia arquivo e o resultado não é server-state cacheável.
export function usePreviewFatura() {
  return useMutation({
    mutationFn: ({ cartaoId, arquivo }: { cartaoId: number; arquivo: File }) =>
      previewFatura(cartaoId, arquivo),
  })
}

// Commit ESCREVE: cria transações/parcelas em vários meses e marca faturas pagas.
// Invalida tudo que essa escrita move — transações, estatísticas, cartões, faturas
// (lista/detalhe/competência) e parcelas. Sem toast aqui: a tela de recibo é a
// confirmação (mostra as contagens que o toast truncaria).
export function useCommitFatura() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: FaturaCommitRequest) => commitFatura(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: ['statistics'] })
      qc.invalidateQueries({ queryKey: ['cards'] })
      qc.invalidateQueries({ queryKey: ['invoices'] })
      qc.invalidateQueries({ queryKey: ['invoice-detail'] })
      qc.invalidateQueries({ queryKey: ['competencia-faturas'] })
      qc.invalidateQueries({ queryKey: ['installments'] })
    },
  })
}
