import { beforeEach, describe, expect, it } from 'vitest'
import {
  ROTA_INICIAL,
  proximaRota,
  registrarRota,
  resetarRotas,
  rotaAnterior,
} from './rotaAnterior'

describe('proximaRota', () => {
  it('a primeira rota não tem anterior', () => {
    expect(proximaRota(ROTA_INICIAL, '/dashboard')).toEqual({
      anterior: null,
      atual: '/dashboard',
    })
  })

  it('a segunda rota empurra a primeira para anterior', () => {
    const passo1 = proximaRota(ROTA_INICIAL, '/dashboard')
    expect(proximaRota(passo1, '/settings')).toEqual({
      anterior: '/dashboard',
      atual: '/settings',
    })
  })

  it('repetir a MESMA rota não mexe no estado', () => {
    // O caso que estraga a pista sem quebrar nada: um navigate(replace) para o
    // mesmo path, ou o efeito rodando duas vezes (StrictMode em dev), faria
    // anterior === atual === '/settings' — e o e-mail diria "vinha de
    // /settings", que é onde o formulário mora.
    const estado = proximaRota(proximaRota(ROTA_INICIAL, '/dashboard'), '/settings')
    const repetido = proximaRota(estado, '/settings')

    expect(repetido).toBe(estado)
    expect(repetido.anterior).toBe('/dashboard')
  })

  it('só guarda a rota imediatamente anterior, não o histórico', () => {
    let estado = proximaRota(ROTA_INICIAL, '/dashboard')
    estado = proximaRota(estado, '/cards')
    estado = proximaRota(estado, '/import/fatura')
    estado = proximaRota(estado, '/settings')

    expect(estado.anterior).toBe('/import/fatura')
  })

  it('ida e volta para a mesma rota vale — não é o mesmo caso do repetido', () => {
    let estado = proximaRota(ROTA_INICIAL, '/settings')
    estado = proximaRota(estado, '/cards')
    estado = proximaRota(estado, '/settings')

    expect(estado.anterior).toBe('/cards')
  })
})

describe('estado de módulo', () => {
  beforeEach(resetarRotas)

  it('sem navegação nenhuma, a rota anterior é null', () => {
    // Reload ou link direto em /settings: o e-mail dirá "não registrada".
    expect(rotaAnterior()).toBeNull()
  })

  it('acompanha as navegações registradas', () => {
    registrarRota('/dashboard')
    registrarRota('/settings')

    expect(rotaAnterior()).toBe('/dashboard')
  })
})
