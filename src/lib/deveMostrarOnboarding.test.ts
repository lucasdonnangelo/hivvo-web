import { describe, expect, it } from 'vitest'
import { deveMostrarOnboarding } from './deveMostrarOnboarding'

const SEM_CARTAO: { ativo: boolean }[] = []
const COM_CARTAO = [{ ativo: true }]
const SEM_HISTORICO = { meses_com_dados: 0 }
const COM_HISTORICO = { meses_com_dados: 6 }

describe('deveMostrarOnboarding', () => {
  it('mostra para quem não tem cartão nem histórico', () => {
    expect(deveMostrarOnboarding(SEM_CARTAO, SEM_HISTORICO, false)).toBe(true)
  })

  // O BUG QUE ABRIU O BATCH: a condição antiga era `&&`, então cadastrar o
  // cartão — o passo 1 — derrubava o banner e os passos 2 e 3 nunca apareceram.
  it('MOSTRA com cartão e sem histórico — o passo 2 ainda está em aberto', () => {
    expect(deveMostrarOnboarding(COM_CARTAO, SEM_HISTORICO, false)).toBe(true)
  })

  it('some quando os dois passos estão feitos', () => {
    expect(deveMostrarOnboarding(COM_CARTAO, COM_HISTORICO, false)).toBe(false)
  })

  // Sem resposta não se decide: o chute errado trata veterano como novato.
  it('não mostra sem coverage — carregando ou erro', () => {
    expect(deveMostrarOnboarding(SEM_CARTAO, undefined, false)).toBe(false)
    expect(deveMostrarOnboarding(SEM_CARTAO, SEM_HISTORICO, true)).toBe(false)
  })
})
