import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createCard,
  deactivateCard,
  getCards,
  getCompetenciaFaturas,
  getInvoiceDetail,
  getInvoices,
  getNextDueInvoice,
  setInvoicePayment,
  updateCard,
  type CardPayload,
} from '../services/cards'
import { errorDetail } from '../lib/extractDetail'
import { useUIStore } from '../store/uiStore'

export function useCards() {
  return useQuery({
    queryKey: ['cards'],
    queryFn: getCards,
    staleTime: 5 * 60 * 1000,
  })
}

export function useCreateCard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CardPayload) => createCard(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cards'] })
      useUIStore.getState().addToast({ message: 'Cartão adicionado', type: 'success' })
    },
  })
}

export function useUpdateCard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<CardPayload> }) =>
      updateCard(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cards'] })
      useUIStore.getState().addToast({ message: 'Cartão atualizado', type: 'success' })
    },
  })
}

export function useDeactivateCard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deactivateCard(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cards'] }),
  })
}

export function useInvoices(cardId: number | null) {
  return useQuery({
    queryKey: ['invoices', cardId],
    queryFn: () => getInvoices(cardId!),
    enabled: cardId !== null,
    staleTime: 2 * 60 * 1000,
  })
}

export function useInvoiceDetail(cardId: number | null, ano: number, mes: number) {
  return useQuery({
    queryKey: ['invoice-detail', cardId, ano, mes],
    queryFn: () => getInvoiceDetail(cardId!, ano, mes),
    enabled: cardId !== null,
    staleTime: 2 * 60 * 1000,
  })
}

// ─── Lente 3d: faturas por competência (1 mês × N cartões) ──────────────────────

export function useCompetenciaFaturas(ano: number, mes: number) {
  return useQuery({
    queryKey: ['competencia-faturas', ano, mes],
    queryFn: () => getCompetenciaFaturas(ano, mes),
    staleTime: 2 * 60 * 1000,
  })
}

export function useNextDueInvoice() {
  return useQuery({
    queryKey: ['invoices', 'next-due'],
    queryFn: getNextDueInvoice,
    staleTime: 5 * 60 * 1000,
  })
}

// Confirmar/desmarcar pagamento de uma fatura. Reversível (um clique, sem modal).
// Invalida tudo que o pagamento move: as faturas (lista + next-due por prefixo), o
// detalhe, a competência, e as STATISTICS — o `a_pagar` do Dashboard passa a ler
// PagamentoFatura, então confirmar/desmarcar muda o "A pagar".
export function useSetInvoicePayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ cardId, ano, mes, pago }: { cardId: number; ano: number; mes: number; pago: boolean }) =>
      setInvoicePayment(cardId, ano, mes, pago),
    onSuccess: (_data, { pago }) => {
      qc.invalidateQueries({ queryKey: ['invoices'] })
      qc.invalidateQueries({ queryKey: ['invoice-detail'] })
      qc.invalidateQueries({ queryKey: ['competencia-faturas'] })
      qc.invalidateQueries({ queryKey: ['statistics'] })
      useUIStore.getState().addToast({
        message: pago ? 'Fatura marcada como paga' : 'Pagamento desmarcado',
        type: 'success',
      })
    },
    onError: (err) => {
      useUIStore.getState().addToast({
        message: errorDetail(err, 'Não foi possível atualizar o pagamento.'),
        type: 'error',
      })
    },
  })
}
