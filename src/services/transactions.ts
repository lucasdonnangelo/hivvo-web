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

// Backup/export JSON (SettingsPage): usa o endpoint dedicado SEM teto, pois o
// GET /transactions ganhou limit default 100 (API Batch 8) — caso contrário o
// backup sairia truncado. unwrapList preserva a tolerância de contrato (Web-Batch 6).
export const getAllTransactions = () =>
  api.get<Transaction[]>('/transactions/export').then((r) => unwrapList<Transaction>(r.data))

export const createTransaction = (payload: TransactionCreatePayload) =>
  api.post<Transaction>('/transactions', payload).then((r) => r.data)

export const updateTransaction = (id: number, payload: Partial<Transaction>) =>
  api.put<Transaction>(`/transactions/${id}`, payload).then((r) => r.data)

export const deleteTransaction = (id: number) =>
  api.delete(`/transactions/${id}`)
