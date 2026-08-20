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

// Auto-categoria de UMA linha, endereçada por `indice` em fatura.transacoes —
// array PARALELO, alinhado por índice EXPLÍCITO (nunca por posição). Só linha
// que materializa (compra/iof com valor != 0, inclusive estorno) tem item.
export interface EnriquecimentoFaturaLinha {
  indice: number
  // NOME da categoria (não id — não existe id de categoria no modelo).
  // null = nenhuma camada teve o que dizer; a tela mostra 'Outros'.
  categoria_sugerida: string | null
  // Qual camada carregou o peso: 'historico' = o usuário já categorizou esta
  // descrição antes; 'regra' = prefixo de adquirente ou palavra-chave.
  origem_sugestao: 'historico' | 'regra' | null
  // A data da linha caiu fora do que a fatura permite. Assimétrico DE PROPÓSITO:
  // só o limite SUPERIOR (`data > emissao`). `periodo.de` NÃO vira limite
  // inferior — ele é a data de ORIGEM da parcelada mais antiga, então um limite
  // tirado dali seria derivado das próprias linhas que ele validaria (circular)
  // e flagaria parcelamento longo LEGÍTIMO.
  //
  // null = a regra não flagou OU não rodou (emissao ausente) — e não rodar não
  // é erro. Nunca bloqueia e nunca corrige: não sabemos qual é a data certa.
  //
  // É Literal e não bool para o front NÃO re-derivar de que lado a data caiu —
  // re-derivar seria reimplementar a regra, do lado errado. Gêmeo do campo em
  // EnriquecimentoLinha do extrato, que tem DOIS valores pelo mesmo motivo.
  data_suspeita: 'posterior_a_emissao' | null
}

export interface FaturaPreviewResponse {
  cartao_id: number
  fatura: FaturaExtraida
  reconciliacao: ReconciliacaoFatura
  faturas_passadas: FaturaPassada[]
  enriquecimento: EnriquecimentoFaturaLinha[]
}

// --- Commit: reenvia a fatura revisada (mesma FaturaExtraida + categoria/linha) ---

// `categoria` é TRI-ESTADO, a mesma forma do `importar` do extrato:
// - string (INCLUSIVE 'Outros'): o usuário DECIDIU — vale sempre, o servidor só
//   revalida que a categoria existe para ele, naquele tipo;
// - null: NÃO decidido → o servidor RECOMPUTA a própria sugestão, com o mesmo
//   matcher do preview.
// O front manda null na linha que o usuário não tocou — vale para despesa E
// para o ESTORNO (#43): os dois têm seletor na tela agora, o de estorno na
// seção "Entram como crédito". null ali significa só "usuário não mexeu".
export interface TransacaoCommit extends TransacaoFatura {
  categoria: string | null
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
  // estornos (crédito) agora são MATERIALIZADOS como transações tipo=estorno — este
  // é o total gravado (antes eram descartados; o sentido inverteu, ex-estornos_ignorados)
  estornos_importados: number
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
