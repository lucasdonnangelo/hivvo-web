import { describe, it, expect } from 'vitest'
import { patchNotificarVencimento, estadoDoToggle } from './preferencias'

describe('patchNotificarVencimento', () => {
  // O teste que justifica o módulo existir. `false` é o valor que as formas
  // idiomáticas de payload condicional descartam — e é o valor que o usuário
  // manda quando DESLIGA, ou seja, o caminho inteiro do controle.
  it('manda false explicitamente, não um objeto vazio', () => {
    const patch = patchNotificarVencimento(false)

    expect(patch).toEqual({ notificar_vencimento: false })
    expect('notificar_vencimento' in patch).toBe(true)
    expect(Object.keys(patch)).toHaveLength(1)
  })

  it('manda true do mesmo jeito', () => {
    expect(patchNotificarVencimento(true)).toEqual({ notificar_vencimento: true })
  })

  // JSON.stringify é o que de fato viaja: um `undefined` sobreviveria ao
  // toEqual acima e sumiria aqui.
  it('sobrevive à serialização', () => {
    expect(JSON.stringify(patchNotificarVencimento(false))).toBe(
      '{"notificar_vencimento":false}',
    )
  })
})

describe('estadoDoToggle', () => {
  it('reflete o servidor quando o valor é conhecido', () => {
    expect(estadoDoToggle(true)).toEqual({ ligado: true, carregando: false })
    expect(estadoDoToggle(false)).toEqual({ ligado: false, carregando: false })
  })

  // Entre o boot e o getMe() do App.tsx o store não tem usuário. Assumir
  // "ligado" aí mostraria o valor errado para quem desligou.
  it('fica carregando enquanto o usuário não chegou', () => {
    expect(estadoDoToggle(undefined)).toEqual({ ligado: false, carregando: true })
  })
})
