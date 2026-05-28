import api from './api'

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
}

export const getTransactions = (mes: number, ano: number) =>
  api.get<Transaction[]>('/transactions', { params: { mes, ano } }).then((r) => r.data)

export const createTransaction = (payload: Omit<Transaction, 'id'>) =>
  api.post<Transaction>('/transactions', payload).then((r) => r.data)

export const updateTransaction = (id: number, payload: Partial<Transaction>) =>
  api.put<Transaction>(`/transactions/${id}`, payload).then((r) => r.data)

export const deleteTransaction = (id: number) =>
  api.delete(`/transactions/${id}`)
