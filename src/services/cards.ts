import api from './api'
import { unwrapList } from '../lib/unwrapList'

export interface Card {
  id: number
  nome: string
  // null quando o cartão não tem limite pré-definido (premium/black). A UI que
  // exibe o limite (CardVisual) degrada sem barra/percentual nesse caso.
  limite: string | null
  dia_fechamento: number
  dia_vencimento: number
  mes_offset_vencimento: number
  tipo: 'Crédito' | 'Débito' | 'Ambos'
  ativo: boolean
  fatura_aberta_total: string | null
}

export interface CardPayload {
  nome: string
  limite: number | null
  dia_fechamento: number | null
  dia_vencimento: number | null
  mes_offset_vencimento: number | null
  tipo: 'Crédito' | 'Débito' | 'Ambos'
  ativo?: boolean
}

export interface InvoiceListItem {
  ano: number
  mes: number
  total: string
  data_vencimento: string
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
  api.get<Card[]>('/cards').then((r) => unwrapList<Card>(r.data))

export const createCard = (payload: CardPayload) =>
  api.post<Card>('/cards', payload).then((r) => r.data)

export const updateCard = (id: number, payload: Partial<CardPayload>) =>
  api.put<Card>(`/cards/${id}`, payload).then((r) => r.data)

export const deactivateCard = (id: number) =>
  api.put<Card>(`/cards/${id}`, { ativo: false }).then((r) => r.data)

export const deleteCard = (id: number) =>
  api.delete(`/cards/${id}`)

export const getInvoices = (cardId: number) =>
  api.get<InvoiceListItem[]>(`/cards/${cardId}/invoices`).then((r) => unwrapList<InvoiceListItem>(r.data))

export const getInvoiceDetail = (cardId: number, ano: number, mes: number) =>
  api.get<InvoiceDetail>(`/cards/${cardId}/invoices/${ano}/${mes}`).then((r) => r.data)

// ─── Lente 3d: faturas por competência (1 mês × N cartões) ──────────────────────

export interface FaturaCartaoItem {
  cartao_id: number
  cartao_nome: string
  total: string
  data_vencimento: string | null
}

export interface CompetenciaFaturas {
  ano: number
  mes: number
  total_geral: string
  faturas: FaturaCartaoItem[]
}

export interface ProximaFatura {
  ano: number
  mes: number
}

export const getCompetenciaFaturas = (ano: number, mes: number) =>
  api.get<CompetenciaFaturas>(`/invoices/${ano}/${mes}`).then((r) => r.data)

export const getNextDueInvoice = () =>
  api.get<ProximaFatura>('/invoices/next-due').then((r) => r.data)
