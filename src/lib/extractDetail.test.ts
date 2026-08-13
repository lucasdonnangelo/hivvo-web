import { describe, expect, it } from 'vitest'
import { ERRO_LIMITE, errorDetail, extractDetail } from './extractDetail'

// Erro do axios, na forma em que ele chega às telas.
const erro = (status: number, data?: unknown) => ({ response: { status, data } })

describe('errorDetail — 429 de qualquer endpoint limitado', () => {
  it('traduz o 429 do slowapi, cuja chave é `error` e não `detail`', () => {
    // Este é o corpo REAL do slowapi (extension.py). A busca por `detail` acha
    // undefined — era por isso que o usuário via o fallback genérico da tela.
    const resposta = erro(429, { error: 'Rate limit exceeded: 5 per 1 hour' })

    expect(errorDetail(resposta, 'Não foi possível importar o extrato.')).toBe(ERRO_LIMITE)
  })

  it('o fallback da tela NÃO ganha do 429 — era ele que mentia', () => {
    const resposta = erro(429, { error: 'Rate limit exceeded: 5 per 1 hour' })

    expect(errorDetail(resposta, 'Erro ao adicionar cartão.')).not.toContain('cartão')
  })

  it('a tela pode passar cópia própria no lugar do padrão', () => {
    const propria = 'Você já enviou várias mensagens na última hora.'

    expect(errorDetail(erro(429), 'genérico', propria)).toBe(propria)
  })

  it('429 sem corpo nenhum ainda é reconhecido — o status é o contrato', () => {
    expect(errorDetail(erro(429))).toBe(ERRO_LIMITE)
  })
})

describe('errorDetail — demais status seguem como antes', () => {
  it('devolve o detail do backend quando ele é string', () => {
    expect(errorDetail(erro(400, { detail: 'Escreva sua mensagem antes de enviar.' }))).toBe(
      'Escreva sua mensagem antes de enviar.',
    )
  })

  it('devolve o detail do 502 do feedback', () => {
    const detail = 'Não foi possível enviar sua mensagem agora. Tente de novo em instantes.'

    expect(errorDetail(erro(502, { detail }), 'fallback')).toBe(detail)
  })

  it('cai no fallback da tela quando não há detail legível', () => {
    expect(errorDetail(erro(500, {}), 'Erro ao salvar.')).toBe('Erro ao salvar.')
  })

  it('erro de rede (sem response) cai no fallback', () => {
    expect(errorDetail(new Error('Network Error'), 'Erro ao salvar.')).toBe('Erro ao salvar.')
  })
})

describe('extractDetail — comportamento ATUAL do 422 (defeito registrado)', () => {
  // ⚠️ CARACTERIZAÇÃO, não aprovação. Estes dois testes fixam o que o código faz
  // HOJE com o `detail` em lista do Pydantic, que é despejar a string crua do
  // backend na cara do usuário. Não foi consertado nesta leva porque mudaria
  // mensagens em telas de cadastro, cartão e importação que ninguém revisou —
  // blast radius diferente do 429, que era aditivo. Quando alguém consertar, é
  // AQUI que o teste vai virar vermelho, e é para isso que ele existe.
  it('mostra o msg cru do Pydantic, em inglês', () => {
    const detail = [{ msg: 'String should have at most 4000 characters', loc: ['body', 'mensagem'] }]

    expect(extractDetail(detail)).toBe('String should have at most 4000 characters')
  })

  it('mostra o prefixo "Value error," de validador próprio', () => {
    const detail = [{ msg: 'Value error, Senha deve ter ao menos 8 caracteres' }]

    expect(extractDetail(detail)).toBe('Value error, Senha deve ter ao menos 8 caracteres')
  })
})
