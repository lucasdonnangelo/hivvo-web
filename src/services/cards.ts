import api from './api'

export interface Card {
  id: number
  nome: string
  limite: string
  dia_fechamento: number
  dia_vencimento: number
  mes_offset_vencimento: number
  tipo: 'Crédito' | 'Débito' | 'Ambos'
  ativo: boolean
  fatura_aberta_total: string | null
}

export interface CardPayload {
  nome: string
  limite: number
  dia_fechamento: number
  dia_vencimento: number
  mes_offset_vencimento: number
  tipo: 'Crédito' | 'Débito' | 'Ambos'
  ativo?: boolean
}

export interface InvoiceListItem {
  ano: number
  mes: number
  total: string
  data_vencimento: string
  status: 'aberta' | 'fechada' | 'futura'
}

export interface ParcelaFaturaItem {
  id: number
  descricao: string
  valor_parcela: string
  numero_parcela: number
  total_parcelas: number
  categoria: string
  data: string
}

export interface TransacaoFaturaItem {
  id: number
  descricao: string
  valor: string
  categoria: string
  data: string
}

export interface InvoiceDetail {
  total: string
  data_vencimento: string
  parcelas: ParcelaFaturaItem[]
  avulsas: TransacaoFaturaItem[]
}

export const getCards = () =>
  api.get<Card[]>('/cards').then((r) => r.data)

export const createCard = (payload: CardPayload) =>
  api.post<Card>('/cards', payload).then((r) => r.data)

export const updateCard = (id: number, payload: Partial<CardPayload>) =>
  api.put<Card>(`/cards/${id}`, payload).then((r) => r.data)

export const deactivateCard = (id: number) =>
  api.put<Card>(`/cards/${id}`, { ativo: false }).then((r) => r.data)

export const deleteCard = (id: number) =>
  api.delete(`/cards/${id}`)

export const getInvoices = (cardId: number) =>
  api.get<InvoiceListItem[]>(`/cards/${cardId}/invoices`).then((r) => r.data)

export const getInvoiceDetail = (cardId: number, ano: number, mes: number) =>
  api.get<InvoiceDetail>(`/cards/${cardId}/invoices/${ano}/${mes}`).then((r) => r.data)
