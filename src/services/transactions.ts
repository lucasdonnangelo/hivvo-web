import api from './api'
import { unwrapList } from '../lib/unwrapList'

export interface Transaction {
  id: number
  tipo: 'receita' | 'despesa'
  valor: string
  descricao: string
  categoria: string
  data: string
  forma_pagamento: string
  cartao_id: number | null
  parcelado: boolean
  total_parcelas: number | null
}

export interface TransactionCreatePayload {
  tipo: 'receita' | 'despesa'
  valor: string
  descricao: string
  categoria: string
  data: string
  forma_pagamento: string
  cartao_id: number | null
  parcelado: boolean
  total_parcelas?: number
}

export const getTransactions = (mes: number, ano: number) =>
  api.get<Transaction[]>('/transactions', { params: { mes, ano } }).then((r) => unwrapList<Transaction>(r.data))

export const getAllTransactions = () =>
  api.get<Transaction[]>('/transactions').then((r) => unwrapList<Transaction>(r.data))

export const createTransaction = (payload: TransactionCreatePayload) =>
  api.post<Transaction>('/transactions', payload).then((r) => r.data)

export const updateTransaction = (id: number, payload: Partial<Transaction>) =>
  api.put<Transaction>(`/transactions/${id}`, payload).then((r) => r.data)

export const deleteTransaction = (id: number) =>
  api.delete(`/transactions/${id}`)
