import api from './api'
import { unwrapList } from '../lib/unwrapList'

// Recorrência = cabeçalho (identidade) + linha do tempo de vigências (valores).
// Valores monetários são Decimal no backend → sempre STRING no contrato (nunca
// number), igual aos demais services. O id é UUID (string).

export interface RecorrenciaVigencia {
  valor: string
  mes_inicio: number
  ano_inicio: number
  mes_fim: number | null
  ano_fim: number | null
}

export interface Recorrencia {
  id: string
  tipo: 'receita' | 'despesa'
  categoria: string
  forma_pagamento: string
  frequencia: string
  dia_do_mes: number
  descricao: string
  ativa: boolean
  data_criacao: string
  // Valor da vigência do mês corrente (null se nada vige — encerrada ou início
  // futuro), para a listagem mostrar "salário: R$X" sem abrir o detalhe.
  valor_vigente: string | null
}

export interface RecorrenciaDetail extends Recorrencia {
  vigencias: RecorrenciaVigencia[]
}

export interface RecorrenciaCreate {
  tipo: 'receita' | 'despesa'
  valor: string
  categoria: string
  forma_pagamento: string
  dia_do_mes: number
  descricao: string
  // Início opcional (os dois pareados): ausente = backend aplica a regra do dia.
  mes_inicio?: number
  ano_inicio?: number
}

export interface RecorrenciaUpdate {
  valor?: string
  descricao?: string
  categoria?: string
  dia_do_mes?: number
  forma_pagamento?: string
}

export const getRecorrencias = (incluirEncerradas = false) =>
  api
    .get<Recorrencia[]>('/recorrencias', { params: { incluir_encerradas: incluirEncerradas } })
    .then((r) => unwrapList<Recorrencia>(r.data))

export const getRecorrencia = (id: string) =>
  api.get<RecorrenciaDetail>(`/recorrencias/${id}`).then((r) => r.data)

export const createRecorrencia = (payload: RecorrenciaCreate) =>
  api.post<RecorrenciaDetail>('/recorrencias', payload).then((r) => r.data)

export const updateRecorrencia = (id: string, payload: RecorrenciaUpdate) =>
  api.patch<RecorrenciaDetail>(`/recorrencias/${id}`, payload).then((r) => r.data)

export const deleteRecorrencia = (id: string) =>
  api.delete(`/recorrencias/${id}`)
