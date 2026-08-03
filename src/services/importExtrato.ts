import api from './api'

// Contrato da importação de EXTRATO de conta — espelha 1:1 os schemas do backend
// (hivvo-api/app/schemas/import_extrato.py). Datas são strings ISO (YYYY-MM-DD) e
// valores decimais são strings. Ao contrário da fatura, `valor` de linha é sempre
// MAGNITUDE positiva — a DIREÇÃO do dinheiro vem do `balde`; só os saldos e o
// rendimento carregam sinal (cheque especial existe). Sem cartao_id: o extrato é
// da CONTA, não de um cartão.

export type BaldeExtrato = 'receita' | 'debito' | 'pagamento_fatura'

export interface PeriodoExtrato {
  de: string
  ate: string
}

export interface LinhaExtrato {
  data: string
  descricao: string
  // MAGNITUDE positiva; a direção vem do balde
  valor: string
  balde: BaldeExtrato
  // só pagamento_fatura: banco/cartão citado na linha; null se a linha não nomeia
  cartao_citado: string | null
}

export interface ExtratoExtraido {
  banco: string
  periodo: PeriodoExtrato | null
  // saldos IMPRESSOS no extrato, COM sinal; null quando o extrato não os imprime
  saldo_inicial: string | null
  saldo_final: string | null
  // "Rendimento líquido" do RESUMO — NÃO é linha de movimentação. "0.00" se ausente.
  rendimento: string
  linhas: LinhaExtrato[]
}

export interface ReconciliacaoExtrato {
  // false quando o extrato não imprime saldo_inicial E saldo_final (walk N/A) —
  // aí `bate` é sempre false (não há o que conferir); o banner vira neutro.
  aplicavel: boolean
  saldo_inicial: string
  rendimento: string
  soma_receitas: string
  soma_debitos: string
  soma_pagamentos_fatura: string
  saldo_final_calc: string
  saldo_final_declarado: string
  // saldo_final_calc − saldo_final_declarado
  diferenca: string
  bate: boolean
}

// Uma fatura (cartão + competência) que PODE ser a quitada pela linha. O valor é
// sinal de CONFIANÇA, não filtro: pagamento parcial/mínimo é real.
export interface FaturaCandidata {
  cartao_id: number
  cartao_nome: string
  fatura_mes: number
  fatura_ano: number
  total_fatura: string
  // valor da linha − total_fatura
  diferenca: string
  valor_bate: boolean
  // já existe PagamentoFatura pago=True nessa competência (o commit sobrescreve
  // o valor assumido pelo REAL do extrato)
  ja_paga: boolean
}

export type FaturaPropostaStatus = 'match_unico' | 'ambiguo' | 'sem_match'

export interface FaturaProposta {
  status: FaturaPropostaStatus
  // match_unico = 1 elemento; ambiguo = N (ordenadas por confiança); sem_match = 0
  candidatas: FaturaCandidata[]
  motivo: string | null
}

// A recorrência que provavelmente já explica esta receita (armadilha do salário).
export interface RecorrenciaCasada {
  id: string
  descricao: string
  categoria: string
  valor_vigente: string
  dia_do_mes: number
  competencia_mes: number
  competencia_ano: number
}

// Enriquecimento de UMA linha, endereçado por `indice` em extrato.linhas — array
// PARALELO, alinhado por índice EXPLÍCITO (nunca por posição; pode vir menor).
export interface EnriquecimentoLinha {
  indice: number
  // debito/receita; null = a categorização falhou ("Outros" é palpite, null é ausência)
  categoria_sugerida: string | null
  // só pagamento_fatura
  fatura_proposta: FaturaProposta | null
  // só receita
  provavel_recorrencia: boolean
  recorrencia_casada: RecorrenciaCasada | null
  // A data da linha caiu fora do período do extrato. Aqui o intervalo INTEIRO
  // vale como âncora (ao contrário da fatura, que só checa o limite superior):
  // no extrato o período é um intervalo real do documento, sem parcela
  // esticando a faixa.
  //
  // null = a regra não flagou OU não rodou (`periodo` ausente ou INVERTIDO — o
  // preview não rejeita período invertido, só o commit, e sem essa guarda uma
  // âncora incoerente flagaria TODAS as linhas). Não rodar não é erro.
  //
  // DOIS valores e não um bool: a cópia difere por lado, e um bool obrigaria o
  // front a re-derivar qual — reimplementar a regra do lado errado.
  data_suspeita: 'antes_do_periodo' | 'depois_do_periodo' | null
}

export interface ExtratoPreviewResponse {
  extrato: ExtratoExtraido
  reconciliacao: ReconciliacaoExtrato
  enriquecimento: EnriquecimentoLinha[]
}

// --- Commit: reenvia o extrato revisado (mesmas linhas + decisões por linha) ---

export interface LinhaCommit extends LinhaExtrato {
  // sempre explícito no front: a tela É a decisão do usuário (o tri-estado null
  // = "servidor decide" fica para clientes que não decidem)
  importar: boolean
  categoria: string
  // só pagamento_fatura com importar=true: o casamento CONFIRMADO na revisão
  cartao_id?: number
  fatura_mes?: number
  fatura_ano?: number
}

export interface ExtratoCommit extends Omit<ExtratoExtraido, 'linhas'> {
  linhas: LinhaCommit[]
}

export interface ExtratoCommitRequest {
  extrato: ExtratoCommit
  // o rendimento do RESUMO vira receita "Rendimentos"; só materializa se > 0
  importar_rendimento: boolean
}

export interface ExtratoCommitResponse {
  receitas_criadas: number
  debitos_criados: number
  // PagamentoFatura gravados com valor e data REAIS do extrato; duas linhas na
  // mesma (cartão, competência) somam num único registro — contam 1 aqui
  pagamentos_registrados: number
  // subconjunto: já constavam pagas e o valor_pago foi substituído pelo REAL
  pagamentos_sobrescritos: number
  rendimento_importado: boolean
  // decisão final "não importar" (explícita ou default seguro do servidor)
  linhas_ignoradas: number
  // subconjunto: receitas INDECISAS que casaram com recorrência vigente
  receitas_puladas_recorrencia: number
  reconciliacao_bate: boolean
}

// POST /import/extrato/preview — multipart (só o PDF; sem cartao_id). Chama o
// Gemini: leva segundos. STATELESS (nada é persistido). Erros: 400 (não-PDF),
// 413 (grande), 422 (escaneado/páginas demais), 502 (extração inválida),
// 503 (Gemini indisponível). Rate limit 5/min por usuário.
export const previewExtrato = (arquivo: File) => {
  const form = new FormData()
  form.append('arquivo', arquivo)
  // Sem Content-Type manual: o axios define o boundary do multipart ao ver FormData.
  return api
    .post<ExtratoPreviewResponse>('/import/extrato/preview', form)
    .then((r) => r.data)
}

// POST /import/extrato/commit — grava receitas/débitos/pagamentos (+ rendimento)
// numa transação única. SEQUENCIAL (um extrato por vez). Erros: 409 (extrato já
// importado — idempotência por usuário+banco+período), 422 (período ausente,
// competência sem fatura, categoria inválida), 404 (cartão), 503.
export const commitExtrato = (payload: ExtratoCommitRequest) =>
  api.post<ExtratoCommitResponse>('/import/extrato/commit', payload).then((r) => r.data)
