import api from './api'

// Contrato da importação de fatura — espelha 1:1 os schemas do backend
// (hivvo-api/app/schemas/import_fatura.py). Datas são strings ISO (YYYY-MM-DD) e
// valores decimais são strings COM o sinal impresso (estorno = negativo). O front
// só EXIBE/edita categoria+apagar e reenvia o objeto `fatura` inteiro no commit —
// a aritmética (reconciliação, materialização) mora toda no backend.

export type TipoTransacaoFatura = 'compra' | 'iof' | 'pagamento' | 'ajuste_saldo'

export interface CompetenciaFatura {
  mes: number
  ano: number
}

export interface PeriodoFatura {
  de: string
  ate: string
}

export interface ParcelaInfoFatura {
  indice: number
  total: number
}

export interface InternacionalFatura {
  moeda_orig: string
  valor_orig: string
  taxa: string | null
}

export interface TransacaoFatura {
  data: string
  descricao: string
  // decimal string, COM o sinal impresso na fatura (estorno = compra negativa)
  valor_brl: string
  tipo: TipoTransacaoFatura
  parcela: ParcelaInfoFatura | null
  portador_final: string | null
  internacional: InternacionalFatura | null
}

export interface FaturaExtraida {
  banco: string
  competencia: CompetenciaFatura
  periodo: PeriodoFatura | null
  emissao: string | null
  vencimento: string | null
  total_a_pagar: string
  total_compras_periodo: string
  total_iof_periodo: string
  transacoes: TransacaoFatura[]
}

export interface ReconciliacaoFatura {
  ancora: string
  soma_gastos: string
  excluidos: string
  total_a_pagar: string
  // soma_gastos - ancora (cheque primário). `bate` = |diferenca| <= tolerância.
  diferenca: string
  bate: boolean
  diferenca_secundaria: string
  bate_secundario: boolean
}

export interface FaturaPassada {
  mes: number
  ano: number
  // já existe PagamentoFatura(pago=True) para (cartao, mes, ano) — a UI pré-marca.
  ja_paga: boolean
}

export interface FaturaPreviewResponse {
  cartao_id: number
  fatura: FaturaExtraida
  reconciliacao: ReconciliacaoFatura
  faturas_passadas: FaturaPassada[]
}

// --- Commit: reenvia a fatura revisada (mesma FaturaExtraida + categoria/linha) ---

export interface TransacaoCommit extends TransacaoFatura {
  categoria: string
}

export interface FaturaCommit extends Omit<FaturaExtraida, 'transacoes'> {
  transacoes: TransacaoCommit[]
}

export interface FaturaCommitRequest {
  cartao_id: number
  fatura: FaturaCommit
  competencias_pagas: CompetenciaFatura[]
}

export interface FaturaCommitResponse {
  transacoes_criadas: number
  parcelas_criadas: number
  faturas_marcadas_pagas: number
  // parceladas puladas por dedup entre importações (MULTI-FATURA)
  parceladas_deduplicadas: number
  // estornos (compra negativa) não são graváveis (CHECK valor>0) — só contados
  estornos_ignorados: number
  reconciliacao_bate: boolean
}

// POST /import/fatura/preview — multipart (PDF + cartao_id). Chama o Gemini:
// leva segundos. Erros do backend: 400 (não-PDF), 413 (grande), 422 (escaneada/
// páginas demais), 502 (extração inválida), 503 (Gemini indisponível).
export const previewFatura = (cartaoId: number, arquivo: File) => {
  const form = new FormData()
  form.append('arquivo', arquivo)
  form.append('cartao_id', String(cartaoId))
  // Sem Content-Type manual: o axios define o boundary do multipart ao ver FormData.
  return api
    .post<FaturaPreviewResponse>('/import/fatura/preview', form)
    .then((r) => r.data)
}

// POST /import/fatura/commit — grava transações/parcelas + faturas passadas pagas.
// SEQUENCIAL (uma fatura por vez). Erros: 409 (já importada), 422 (competência
// fora do histórico), 404/503.
export const commitFatura = (payload: FaturaCommitRequest) =>
  api.post<FaturaCommitResponse>('/import/fatura/commit', payload).then((r) => r.data)
