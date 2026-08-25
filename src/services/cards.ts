import api from './api'
import { unwrapList } from '../lib/unwrapList'

export interface Card {
  id: number
  nome: string
  // null quando o cartão não tem limite pré-definido (premium/black). A UI que
  // exibe o limite (CardVisual) degrada sem barra/percentual nesse caso.
  limite: string | null
  dia_fechamento: number
  dia_vencimento: number
  mes_offset_vencimento: number
  tipo: 'Crédito' | 'Débito' | 'Ambos'
  ativo: boolean
  // Total da fatura ABERTA — UMA competência, a corrente do cartão. NÃO é
  // limite consumido: quem responde isso é `limite_usado`. Tratar este campo
  // como "usado" foi o defeito da barra (o limite se "recuperava" na virada do
  // mês e uma compra em 24x quase não aparecia).
  fatura_aberta_total: string | null
  // Limite COMPROMETIDO: o que resta em aberto em TODAS as competências
  // (passadas, corrente e futuras), abatido pelos pagamentos de fatura
  // confirmados, com clamp de cobertura por fatura. Calculado no backend, que é
  // quem tem PagamentoFatura e as parcelas futuras.
  //
  // PODE PASSAR de `limite` — e isso é informação, não erro de conta: significa
  // fatura sem pagamento confirmado. A UI trata o estouro com cópia própria.
  limite_usado: string | null
  // True quando o cartão tem compra lançada (parcela não cancelada ou avulsa de
  // cartão). O backend REJEITA (422) alterar dia_fechamento/dia_vencimento/
  // mes_offset_vencimento nesse caso — o form de edição desabilita esses campos.
  tem_lancamentos?: boolean
}

export interface CardPayload {
  nome: string
  limite: number | null
  dia_fechamento: number | null
  dia_vencimento: number | null
  mes_offset_vencimento: number | null
  tipo: 'Crédito' | 'Débito' | 'Ambos'
  ativo?: boolean
}

// Estado derivado da fatura (backend calcula a partir de PagamentoFatura + venc.):
// - paga         → o usuário confirmou o pagamento integral.
// - paga_parcial → parte da fatura foi paga; ainda resta saldo (#9).
// - aberta       → ainda aceita compras (fechamento não passou). NÃO é confirmável.
// - a_vencer     → fechada, não confirmada, vencimento >= hoje.
// - atrasada     → fechada, não confirmada, vencimento < hoje (exige ação).
// - vazia        → competência SEM lançamento algum (nada a pagar) — estado neutro,
//                  NUNCA alerta; não confundir com `paga`.
// O front NUNCA assume que esta união é exaustiva em runtime: a API pode mandar um
// status futuro que ainda não conhecemos, e o badge degrada para um estado neutro
// em vez de quebrar (ver InvoiceStatusBadge).
export type InvoiceStatus =
  | 'vazia'
  | 'paga'
  | 'paga_parcial'
  | 'aberta'
  | 'a_vencer'
  | 'atrasada'

export interface InvoiceListItem {
  ano: number
  mes: number
  total: string
  data_vencimento: string
  status: InvoiceStatus
}

export interface ParcelaFaturaItem {
  id: number
  descricao: string
  valor_parcela: string
  numero_parcela: number
  total_parcelas: number
  categoria: string
  data: string
}

export interface TransacaoFaturaItem {
  id: number
  descricao: string
  valor: string
  categoria: string
  data: string
  // `estorno` = crédito que abate a fatura; demais avulsas são `despesa`. Como todo
  // `tipo` no front, a apresentação tolera um valor fora da união em runtime (neutro).
  tipo: 'despesa' | 'estorno'
}

export interface InvoiceDetail {
  total: string
  data_vencimento: string
  status: InvoiceStatus
  // #9 — quanto já foi pago da fatura. Opcional/aditivo: só o detalhe expõe. Quando
  // presente (status `paga_parcial`), a UI mostra "faltam R$ X" = total − valor_pago.
  // Ausente → nada é inventado, mostra só o badge.
  valor_pago?: string | null
  parcelas: ParcelaFaturaItem[]
  avulsas: TransacaoFaturaItem[]
}

export const getCards = () =>
  api.get<Card[]>('/cards').then((r) => unwrapList<Card>(r.data))

export const createCard = (payload: CardPayload) =>
  api.post<Card>('/cards', payload).then((r) => r.data)

export const updateCard = (id: number, payload: Partial<CardPayload>) =>
  api.put<Card>(`/cards/${id}`, payload).then((r) => r.data)

export const deactivateCard = (id: number) =>
  api.put<Card>(`/cards/${id}`, { ativo: false }).then((r) => r.data)

export const deleteCard = (id: number) =>
  api.delete(`/cards/${id}`)

export const getInvoices = (cardId: number) =>
  api.get<InvoiceListItem[]>(`/cards/${cardId}/invoices`).then((r) => unwrapList<InvoiceListItem>(r.data))

export const getInvoiceDetail = (cardId: number, ano: number, mes: number) =>
  api.get<InvoiceDetail>(`/cards/${cardId}/invoices/${ano}/${mes}`).then((r) => r.data)

// ─── Lente 3d: faturas por competência (1 mês × N cartões) ──────────────────────

export interface FaturaCartaoItem {
  cartao_id: number
  cartao_nome: string
  total: string
  data_vencimento: string | null
  status: InvoiceStatus
}

export interface CompetenciaFaturas {
  ano: number
  mes: number
  total_geral: string
  faturas: FaturaCartaoItem[]
}

export interface ProximaFatura {
  ano: number
  mes: number
}

export const getCompetenciaFaturas = (ano: number, mes: number) =>
  api.get<CompetenciaFaturas>(`/invoices/${ano}/${mes}`).then((r) => r.data)

export const getNextDueInvoice = () =>
  api.get<ProximaFatura>('/invoices/next-due').then((r) => r.data)

// ─── Confirmar/desmarcar pagamento de fatura (idempotente, reversível) ──────────
// 422 se a fatura está aberta (fechamento não passou) ou não tem lançamentos.
export const setInvoicePayment = (cartaoId: number, ano: number, mes: number, pago: boolean) =>
  api
    .put(`/invoices/${cartaoId}/${ano}/${mes}/pagamento`, { pago })
    .then((r) => r.data)
