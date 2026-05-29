import api from './api'

export interface ParcelaResponse {
  id: number
  transacao_id: number
  cartao_id: number | null
  valor: string
  fatura_mes: number
  fatura_ano: number
  pago: boolean
  cancelado: boolean
  numero_parcela: number
  total_parcelas: number
  descricao: string
  categoria: string
}

export const getInstallments = (params: {
  mes?: number
  ano?: number
  pago?: boolean
  cancelado?: boolean
  cartao_id?: number
}) => api.get<ParcelaResponse[]>('/installments', { params }).then((r) => r.data)
