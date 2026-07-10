import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createCard,
  deactivateCard,
  getCards,
  getCompetenciaFaturas,
  getInvoiceDetail,
  getInvoices,
  getNextDueInvoice,
  updateCard,
  type CardPayload,
} from '../services/cards'
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
