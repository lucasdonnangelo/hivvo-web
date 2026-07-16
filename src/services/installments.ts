import api from './api'
import { unwrapList } from '../lib/unwrapList'

export interface ParcelaResponse {
  id: number
  transacao_id: number
  cartao_id: number | null
  valor_parcela: string
  fatura_mes: number
  fatura_ano: number
  cancelado: boolean
  numero_parcela: number
  total_parcelas: number
  descricao: string
  categoria: string
}

export const getInstallments = (params: {
  mes?: number
  ano?: number
  cancelado?: boolean
  cartao_id?: number
}) => api.get<ParcelaResponse[]>('/installments', { params }).then((r) => unwrapList<ParcelaResponse>(r.data))
