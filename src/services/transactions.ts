import api from './api'
import { unwrapList } from '../lib/unwrapList'

export interface Transaction {
  id: number
  // `estorno` = crédito/reembolso importado de fatura (abate o consumo; não é renda
  // nem despesa). O front NUNCA assume que esta união é exaustiva em runtime: a API
  // pode mandar um tipo futuro e a apresentação degrada para neutro (ver
  // lib/tipoTransacao — presentTipo).
  tipo: 'receita' | 'despesa' | 'estorno'
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
  // `estorno` entrou aqui em #48: o tipo de LEITURA (Transaction) já o aceitava
  // desde 24/07 e o de ESCRITA não — assimetria que era lacuna, não decisão, e
  // deixava o usuário sem como representar um reembolso que não veio de fatura.
  tipo: 'receita' | 'despesa' | 'estorno'
  valor: string
  descricao: string
  categoria: string
  data: string
  forma_pagamento: string
  cartao_id: number | null
  parcelado: boolean
  total_parcelas?: number
}

// #9 — Uma fatura-alvo (cartão + competência) tocada pela compra. Estrutura pura,
// espelha CompetenciaFatura do backend; a copy do aviso é composta no frontend.
export interface CompetenciaFatura {
  cartao_id: number
  fatura_mes: number
  fatura_ano: number
}

// #9 — Aviso NÃO-bloqueante: a compra caiu em competência(s) já marcada(s) como
// paga(s). O backend não embute texto de UI — só a estrutura. Hoje o backend
// emite no máximo um aviso, mas o contrato é uma lista (retrocompatível: vazia).
export interface AvisoFaturaPaga {
  codigo: 'fatura_paga'
  competencias: CompetenciaFatura[]
}

// Corpo completo do POST /transactions (TransacaoCreateResponse do backend):
// a Transaction + metadados da criação. Antes descartávamos tudo menos a
// Transaction; #9 exige o corpo inteiro por causa de `avisos`.
export interface TransactionCreateResponse extends Transaction {
  parcelas_criadas: number
  avisos: AvisoFaturaPaga[]
}

export const getTransactions = (mes: number, ano: number) =>
  api.get<Transaction[]>('/transactions', { params: { mes, ano } }).then((r) => unwrapList<Transaction>(r.data))

// Backup/export JSON (SettingsPage): usa o endpoint dedicado SEM teto, pois o
// GET /transactions ganhou limit default 100 (API Batch 8) — caso contrário o
// backup sairia truncado. unwrapList preserva a tolerância de contrato (Web-Batch 6).
export const getAllTransactions = () =>
  api.get<Transaction[]>('/transactions/export').then((r) => unwrapList<Transaction>(r.data))

export const createTransaction = (payload: TransactionCreatePayload) =>
  api.post<TransactionCreateResponse>('/transactions', payload).then((r) => r.data)

export const updateTransaction = (id: number, payload: Partial<Transaction>) =>
  api.put<Transaction>(`/transactions/${id}`, payload).then((r) => r.data)

export const deleteTransaction = (id: number) =>
  api.delete(`/transactions/${id}`)
