import api from './api'

export interface Card {
  id: number
  nome: string
  limite: string
  dia_fechamento: number
  dia_vencimento: number
  mes_offset_vencimento: number
  tipo: 'credito' | 'debito' | 'ambos'
  ativo: boolean
}

export const getCards = () =>
  api.get<Card[]>('/cards').then((r) => r.data)

export const createCard = (payload: Omit<Card, 'id'>) =>
  api.post<Card>('/cards', payload).then((r) => r.data)

export const updateCard = (id: number, payload: Partial<Card>) =>
  api.put<Card>(`/cards/${id}`, payload).then((r) => r.data)

export const deleteCard = (id: number) =>
  api.delete(`/cards/${id}`)
