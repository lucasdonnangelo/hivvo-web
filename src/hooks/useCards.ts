import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createCard,
  deactivateCard,
  getCards,
  getInvoiceDetail,
  getInvoices,
  updateCard,
  type CardPayload,
} from '../services/cards'

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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cards'] }),
  })
}

export function useUpdateCard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<CardPayload> }) =>
      updateCard(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cards'] }),
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
