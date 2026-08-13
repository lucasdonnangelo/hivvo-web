import { describe, expect, it } from 'vitest'
import {
  ERRO_LONGA,
  ERRO_VAZIO,
  MAX_MENSAGEM,
  montarContexto,
  validarMensagem,
} from './feedback'

const ENTRADA = {
  rotaAnterior: '/dashboard',
  versao: '0.1.0 (abc1234)',
  largura: 390,
  altura: 844,
  dpr: 3,
  userAgent: 'Mozilla/5.0 (iPhone)',
  isMobile: true,
}

describe('validarMensagem', () => {
  // O botão nunca fica disabled: o clique com a caixa vazia tem de PRODUZIR
  // texto. Cada linha aqui é um jeito de a caixa parecer preenchida e não estar.
  it.each([
    ['vazia', ''],
    ['só espaços', '     '],
    ['só quebras de linha', '\n\n\n'],
    ['espaço e tab', ' \t \t '],
  ])('rejeita mensagem %s com a frase que diz o que falta', (_caso, texto) => {
    expect(validarMensagem(texto)).toBe(ERRO_VAZIO)
  })

  it('aceita mensagem com conteúdo', () => {
    expect(validarMensagem('o gráfico não carrega')).toBeNull()
  })

  it('aceita mensagem cercada de espaço — o espaço não é o conteúdo', () => {
    expect(validarMensagem('   quebrou   ')).toBeNull()
  })

  it('aceita exatamente o limite', () => {
    expect(validarMensagem('a'.repeat(MAX_MENSAGEM))).toBeNull()
  })

  it('rejeita um caractere acima do limite', () => {
    expect(validarMensagem('a'.repeat(MAX_MENSAGEM + 1))).toBe(ERRO_LONGA)
  })

  it('mede o limite APÓS o trim — espaço em volta não gasta cota', () => {
    // Sem o trim antes da contagem, colar um texto no limite com um "\n" no fim
    // (o que todo editor produz) seria rejeitado por um caractere invisível.
    expect(validarMensagem(`  ${'a'.repeat(MAX_MENSAGEM)}  `)).toBeNull()
  })
})

describe('montarContexto', () => {
  it('resolve o eixo layout, não devolve só a largura crua', () => {
    expect(montarContexto(ENTRADA).layout).toBe('mobile')
    expect(montarContexto({ ...ENTRADA, isMobile: false }).layout).toBe('desktop')
  })

  it('formata a viewport com o device pixel ratio', () => {
    expect(montarContexto(ENTRADA).viewport).toBe('390x844 @3x')
  })

  it('arredonda dimensões fracionárias — zoom do browser produz float', () => {
    const ctx = montarContexto({ ...ENTRADA, largura: 389.6, altura: 843.2, dpr: 2.625 })
    expect(ctx.viewport).toBe('390x843 @2.63x')
  })

  it('sem rota anterior devolve null, e não string vazia', () => {
    // O backend traduz null em "não registrada". Uma string vazia viraria um
    // campo em branco no e-mail, indistinguível de bug do formulário.
    expect(montarContexto({ ...ENTRADA, rotaAnterior: null }).rota_anterior).toBeNull()
  })

  it('versão ausente vira "desconhecida" em vez de campo em branco', () => {
    // Acontece de verdade: o define do VITE_APP_VERSION vem do vite.config, que
    // o vitest.config substitui — e o harness também não o tem.
    expect(montarContexto({ ...ENTRADA, versao: undefined }).versao).toBe('desconhecida')
  })

  it('corta user-agent comprido no limite que o backend aceita', () => {
    // Passar do max_length devolveria 422, cujo detail em lista o extractDetail
    // renderiza cru — o usuário leria um erro em inglês sobre um campo que ele
    // nunca digitou.
    const ctx = montarContexto({ ...ENTRADA, userAgent: 'u'.repeat(600) })
    expect(ctx.user_agent).toHaveLength(400)
  })

  it('corta rota anterior comprida sem virar null', () => {
    const ctx = montarContexto({ ...ENTRADA, rotaAnterior: `/${'x'.repeat(400)}` })
    expect(ctx.rota_anterior).toHaveLength(200)
  })

  it('não inventa campo de identidade — quem sabe quem é o usuário é o backend', () => {
    expect(Object.keys(montarContexto(ENTRADA)).sort()).toEqual([
      'layout',
      'rota_anterior',
      'user_agent',
      'versao',
      'viewport',
    ])
  })
})
