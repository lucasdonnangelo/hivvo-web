import { describe, it, expect } from 'vitest'
import { buildFaturaPayload } from './helpers'
import type { FaturaPreviewResponse, TransacaoFatura } from '../../../services/importFatura'

// Preview mínimo — só o que buildFaturaPayload lê. Uma linha por caso, com
// descrições que identificam o papel (não a posição): apagar a linha 5 desloca
// o índice de saída das linhas seguintes se algum teste ler por posição, então
// toda asserção busca por `descricao`.
//
// Categorias escolhidas de propósito DIFERENTES do fallback do backend
// ("Outros") e diferentes entre si (despesa leva "Lazer", estorno leva
// "Vestuário") — se o teste usasse "Outros" em qualquer um dos dois, um bug que
// sempre mandasse "Outros" (ou sempre null->"Outros" no backend) passaria pelo
// teste sem ser pego. Índices != posição na lista também de propósito, para não
// disfarçar um bug de indexação (ex.: usar `idx` errado ao ler `edicoes.categorias`).
function linha(overrides: Partial<TransacaoFatura>): TransacaoFatura {
  return {
    data: '2026-01-10',
    descricao: 'linha',
    valor_brl: '10.00',
    tipo: 'compra',
    parcela: null,
    portador_final: null,
    internacional: null,
    ...overrides,
  }
}

const preview: FaturaPreviewResponse = {
  cartao_id: 1,
  fatura: {
    banco: 'Banco Teste',
    competencia: { mes: 1, ano: 2026 },
    periodo: null,
    emissao: null,
    vencimento: null,
    total_a_pagar: '0',
    total_compras_periodo: '0',
    total_iof_periodo: '0',
    transacoes: [
      linha({ descricao: 'DESPESA COM EDICAO', tipo: 'compra', valor_brl: '89.90' }), // idx 0
      linha({ descricao: 'DESPESA SEM EDICAO', tipo: 'compra', valor_brl: '23.40' }), // idx 1
      linha({ descricao: 'ESTORNO COM EDICAO', tipo: 'compra', valor_brl: '-50.00' }), // idx 2
      linha({ descricao: 'ESTORNO SEM EDICAO', tipo: 'compra', valor_brl: '-30.00' }), // idx 3
      linha({ descricao: 'PAGAMENTO COM EDICAO SOBRANDO', tipo: 'pagamento', valor_brl: '-1200.00' }), // idx 4
      linha({ descricao: 'DESPESA APAGADA', tipo: 'compra', valor_brl: '320.00' }), // idx 5
    ],
  },
  reconciliacao: {
    ancora: '0',
    soma_gastos: '0',
    excluidos: '0',
    total_a_pagar: '0',
    diferenca: '0',
    bate: true,
    diferenca_secundaria: '0',
    bate_secundario: true,
  },
  faturas_passadas: [],
  enriquecimento: [],
}

// idx 4 (pagamento) carrega uma edição "sobrando" de propósito: prova que
// `isDespesaLinha || isEstornoLinha` é o que decide, não "existe entrada em
// categorias[idx]" — sem essa linha, (d) passaria mesmo se o gate sumisse.
const edicoes = {
  categorias: { 0: 'Lazer', 2: 'Vestuário', 4: 'Transporte' },
  apagadas: { 5: true as const },
  passadasPagas: {},
}

function acha(payload: ReturnType<typeof buildFaturaPayload>, descricao: string) {
  return payload.fatura.transacoes.find((t) => t.descricao === descricao)
}

describe('buildFaturaPayload', () => {
  // (a) — o bug que este batch conserta: antes, `isDespesaLinha` sozinho
  // descartava a escolha do usuário na linha de crédito e sempre mandava null.
  it('estorno com categoria escolhida leva a categoria escolhida', () => {
    const payload = buildFaturaPayload(preview, edicoes)
    expect(acha(payload, 'ESTORNO COM EDICAO')?.categoria).toBe('Vestuário')
  })

  it('despesa com categoria escolhida continua levando a categoria escolhida', () => {
    const payload = buildFaturaPayload(preview, edicoes)
    expect(acha(payload, 'DESPESA COM EDICAO')?.categoria).toBe('Lazer')
  })

  it('linha sem edição manda categoria null — despesa e estorno', () => {
    const payload = buildFaturaPayload(preview, edicoes)
    expect(acha(payload, 'DESPESA SEM EDICAO')?.categoria).toBeNull()
    expect(acha(payload, 'ESTORNO SEM EDICAO')?.categoria).toBeNull()
  })

  it('linha que não é despesa nem estorno manda null mesmo com edição presente', () => {
    const payload = buildFaturaPayload(preview, edicoes)
    expect(acha(payload, 'PAGAMENTO COM EDICAO SOBRANDO')?.categoria).toBeNull()
  })

  it('linha apagada não entra no payload', () => {
    const payload = buildFaturaPayload(preview, edicoes)
    expect(acha(payload, 'DESPESA APAGADA')).toBeUndefined()
    expect(payload.fatura.transacoes).toHaveLength(5)
  })
})
