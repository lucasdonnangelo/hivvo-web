import { describe, expect, it } from 'vitest'
import { derivarLinhaDoMes, type LinhaDoMes } from './linhaDoMes'

// Em centavos: a comparação de dinheiro não pode depender de float. 11.000 e
// 1.402,50 são exatos em binário, mas centavos "sujos" (1.402,53) não são, e um
// teste futuro com esses valores ficaria intermitente em vez de vermelho.
const cents = (v: number) => Math.round(v * 100)

/**
 * 🔴 A GUARDA DO BATCH.
 *
 * As duas somas que a tela promete ao usuário. Se alguém trocar a FONTE de
 * qualquer campo em linhaDoMes.ts — apontar `saidas` de volta para
 * `consumo.despesas`, ou `aindaSai` para `a_pagar` —, isto fica vermelho.
 * É a guarda contra a classe inteira de bug, não contra um valor específico.
 */
function esperaCadeiaFechada(linha: LinhaDoMes) {
  expect(cents(linha.receitas) - cents(linha.saidas)).toBe(cents(linha.saldo))
  expect(cents(linha.saiu) + cents(linha.aindaSai)).toBe(cents(linha.saidas))
}

/**
 * Resposta de /monthly com os valores REAIS medidos em 25/08/2026.
 *
 * `consumo` e `a_pagar` entram no fixture PADRÃO de propósito, mesmo que a
 * linha não os leia: são as duas fontes erradas que o defeito usava. Com eles
 * presentes e com valores DIFERENTES dos certos, `esperaCadeiaFechada` sozinha
 * fica vermelha se alguém reapontar `saidas` ou `aindaSai` — a guarda não
 * depende de um teste nominal lembrar de existir.
 */
function stats(over: Record<string, unknown> = {}) {
  return {
    receitas: 11000,
    despesas: 1402.5, // FLUXO — o subtraendo do saldo
    saldo: 9597.5,
    realizado: { receitas: 11000, despesas: 1040, saldo: 9960 },
    a_vir: { receitas: 0, despesas: 362.5, saldo: -362.5 },
    consumo: { receitas: 11000, despesas: 9590, saldo: 1410 }, // isca
    a_pagar: 1402.5, // isca (eixo dívida — aqui vale a despesa inteira)
    ...over,
  } as Parameters<typeof derivarLinhaDoMes>[0]
}

describe('derivarLinhaDoMes', () => {
  it('devolve os cinco numeros da linha medida', () => {
    const linha = derivarLinhaDoMes(stats())
    expect(linha.receitas).toBe(11000)
    expect(linha.saidas).toBe(1402.5)
    expect(linha.saldo).toBe(9597.5)
    expect(linha.saiu).toBe(1040)
    expect(linha.aindaSai).toBe(362.5)
    expect(linha.temDecomposicao).toBe(true)
  })

  it('🔴 a cadeia FECHA: receitas - saidas === saldo, saiu + aindaSai === saidas', () => {
    const linha = derivarLinhaDoMes(stats())
    // A forma literal, sobre os valores medidos e exatos em binario.
    expect(linha.receitas - linha.saidas).toBe(linha.saldo)
    expect(linha.saiu + linha.aindaSai).toBe(linha.saidas)
    esperaCadeiaFechada(linha)
  })

  it('NAO le consumo.despesas — era o defeito (9.590 no lugar de 1.402,50)', () => {
    // O card antigo mostrava este 9.590 e o Saldo nao fechava com ele. Se
    // alguem reapontar a fonte, `saidas` vira 9590 e a cadeia quebra aqui.
    const linha = derivarLinhaDoMes(
      stats({ consumo: { receitas: 11000, despesas: 9590, saldo: 1410 } }),
    )
    expect(linha.saidas).toBe(1402.5)
    esperaCadeiaFechada(linha)
  })

  it('NAO le a_pagar — eixo divida, nao eixo tempo', () => {
    // Cenario medido no backend: parcela vencida e nao confirmada paga conta em
    // `realizado` E em `a_pagar`, entao a_pagar vale a despesa INTEIRA aqui.
    // Usar a_pagar como `aindaSai` daria 1040 + 1402,50 = 2442,50 != 1402,50.
    const linha = derivarLinhaDoMes(stats({ a_pagar: 1402.5 }))
    expect(linha.aindaSai).toBe(362.5)
    esperaCadeiaFechada(linha)
  })

  it('aceita o payload CRU da API (Decimal serializado como string)', () => {
    // O backend manda "6200.00", nao 6200 — quem semeia o cache sem passar pelo
    // parseMonthly (o harness faz isso) receberia zeros em silencio. Valores
    // reais da semente capturada em dev/sementes-capturadas.json.
    const linha = derivarLinhaDoMes({
      receitas: '6200.00',
      despesas: '432.10',
      saldo: '5767.90',
      realizado: { receitas: '6200.00', despesas: '432.10', saldo: '5767.90' },
      a_vir: { receitas: '0.00', despesas: '0.00', saldo: '0.00' },
    } as unknown as Parameters<typeof derivarLinhaDoMes>[0])
    expect(linha.receitas).toBe(6200)
    expect(linha.saidas).toBe(432.1)
    expect(linha.saiu).toBe(432.1)
    expect(linha.aindaSai).toBe(0)
    expect(linha.temDecomposicao).toBe(true)
    esperaCadeiaFechada(linha)
  })

  it('string nao-numerica vira zero, nunca NaN', () => {
    const linha = derivarLinhaDoMes({
      receitas: 'abc',
      despesas: '',
      saldo: null,
    } as unknown as Parameters<typeof derivarLinhaDoMes>[0])
    expect(Object.values(linha).every((v) => !Number.isNaN(v))).toBe(true)
    expect(linha.receitas).toBe(0)
    esperaCadeiaFechada(linha)
  })

  /**
   * 🟡 O BURACO QUE `esperaCadeiaFechada` NAO TAPA.
   *
   * A cadeia e satisfeita por CONSTRUCAO se alguem derivar os campos: trocar
   * por `saldo = receitas - saidas` deixa o teste da cadeia VERDE para sempre —
   * vira tautologia, e a mutacao sobrevive. Os dois testes abaixo sao a unica
   * coisa que prova que os campos sao LIDOS.
   *
   * ⚠️ AS FIXTURES SAO INCONSISTENTES DE PROPOSITO. A API nunca devolve isto —
   * e exatamente por isso serve: so um valor que a aritmetica NAO produz
   * distingue leitura de calculo. NAO "conserte" os numeros: consertar apaga o
   * teste. Por isso tambem nao chamam `esperaCadeiaFechada` — aqui a cadeia
   * NAO fecha, e nao deve.
   */
  describe('campos sao LIDOS, nao CALCULADOS (fixtures inconsistentes de proposito)', () => {
    it('saldo INCONSISTENTE de proposito: le stats.saldo (999,00), nao recalcula 9.597,50', () => {
      const linha = derivarLinhaDoMes(
        stats({
          receitas: 11000,
          despesas: 1402.5,
          saldo: 999, // ⚠️ PROPOSITAL: 11.000 - 1.402,50 daria 9.597,50
        }),
      )
      expect(linha.saldo).toBe(999)
      // A prova negativa: se devolvesse o resultado da conta, esta calculando.
      expect(linha.saldo).not.toBe(9597.5)
      // Os outros dois seguem vindo das suas fontes.
      expect(linha.receitas).toBe(11000)
      expect(linha.saidas).toBe(1402.5)
    })

    it('saidas INCONSISTENTE de proposito: le stats.despesas (500,00), nao soma 1.402,50', () => {
      const linha = derivarLinhaDoMes(
        stats({
          despesas: 500, // ⚠️ PROPOSITAL: realizado + a_vir daria 1.402,50
          realizado: { receitas: 11000, despesas: 1040, saldo: 9960 },
          a_vir: { receitas: 0, despesas: 362.5, saldo: -362.5 },
        }),
      )
      expect(linha.saidas).toBe(500)
      expect(linha.saidas).not.toBe(1402.5)
      // E as duas metades seguem lidas, nao redistribuidas para fechar a conta.
      expect(linha.saiu).toBe(1040)
      expect(linha.aindaSai).toBe(362.5)
    })
  })

  it('cadeia fecha com centavos sujos (nao depende de float exato)', () => {
    const linha = derivarLinhaDoMes(
      stats({
        receitas: 8333.33,
        despesas: 1402.53,
        saldo: 6930.8,
        realizado: { receitas: 0, despesas: 1040.01, saldo: 0 },
        a_vir: { receitas: 0, despesas: 362.52, saldo: 0 },
      }),
    )
    esperaCadeiaFechada(linha)
  })

  describe('base zero / contrato degradado', () => {
    it('mes zerado devolve cinco zeros e a cadeia fecha', () => {
      const linha = derivarLinhaDoMes(
        stats({
          receitas: 0,
          despesas: 0,
          saldo: 0,
          realizado: { receitas: 0, despesas: 0, saldo: 0 },
          a_vir: { receitas: 0, despesas: 0, saldo: 0 },
        }),
      )
      expect(linha).toEqual({
        receitas: 0, saidas: 0, saldo: 0, saiu: 0, aindaSai: 0, temDecomposicao: true,
      })
      esperaCadeiaFechada(linha)
    })

    it('sem consumo, sem realizado e sem a_vir: nada de NaN, cadeia intacta', () => {
      const linha = derivarLinhaDoMes({
        receitas: 11000,
        despesas: 1402.5,
        saldo: 9597.5,
      })
      expect(Object.values(linha).every((v) => !Number.isNaN(v))).toBe(true)
      expect(linha.saiu).toBe(1402.5)
      expect(linha.aindaSai).toBe(0)
      esperaCadeiaFechada(linha)
    })

    it('sem decomposicao a flag e FALSE — o componente esconde a sublinha', () => {
      // Sem a flag, um mes corrente exibiria "saiu tudo, ainda sai 0", que e
      // falso. A cadeia e preservada; a afirmacao e que nao pode ser feita.
      expect(
        derivarLinhaDoMes({ receitas: 1, despesas: 1, saldo: 0 }).temDecomposicao,
      ).toBe(false)
    })

    it('so realizado: aindaSai sai por diferenca', () => {
      const linha = derivarLinhaDoMes({
        receitas: 11000,
        despesas: 1402.5,
        saldo: 9597.5,
        realizado: { receitas: 11000, despesas: 1040, saldo: 9960 },
      })
      expect(linha.aindaSai).toBe(362.5)
      expect(linha.temDecomposicao).toBe(true)
      esperaCadeiaFechada(linha)
    })

    it('so a_vir: saiu sai por diferenca', () => {
      const linha = derivarLinhaDoMes({
        receitas: 11000,
        despesas: 1402.5,
        saldo: 9597.5,
        a_vir: { receitas: 0, despesas: 362.5, saldo: -362.5 },
      })
      expect(linha.saiu).toBe(1040)
      expect(linha.temDecomposicao).toBe(true)
      esperaCadeiaFechada(linha)
    })

    it('campos ausentes por completo nao viram NaN', () => {
      const linha = derivarLinhaDoMes({} as Parameters<typeof derivarLinhaDoMes>[0])
      expect(linha).toEqual({
        receitas: 0, saidas: 0, saldo: 0, saiu: 0, aindaSai: 0, temDecomposicao: false,
      })
    })
  })

  describe('valores negativos', () => {
    it('mes com estorno maior que a despesa: saidas negativa, saldo acima da receita', () => {
      // Estorno de 500 contra despesa de 300 na mesma competencia.
      const linha = derivarLinhaDoMes(
        stats({
          receitas: 11000,
          despesas: -200,
          saldo: 11200,
          realizado: { receitas: 0, despesas: -500, saldo: 0 },
          a_vir: { receitas: 0, despesas: 300, saldo: 0 },
        }),
      )
      expect(linha.saidas).toBe(-200)
      expect(linha.saldo).toBe(11200)
      expect(linha.saiu).toBe(-500)
      esperaCadeiaFechada(linha)
    })

    it('saldo negativo (saidas acima das receitas) fecha igual', () => {
      const linha = derivarLinhaDoMes(
        stats({
          receitas: 1000,
          despesas: 2500.75,
          saldo: -1500.75,
          realizado: { receitas: 0, despesas: 2000.25, saldo: 0 },
          a_vir: { receitas: 0, despesas: 500.5, saldo: 0 },
        }),
      )
      expect(linha.saldo).toBe(-1500.75)
      esperaCadeiaFechada(linha)
    })
  })
})
