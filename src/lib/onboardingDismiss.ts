// Dispensa do OnboardingBanner — a ÚNICA coisa que o app guarda em localStorage.
//
// A chave é POR USUÁRIO. A versão anterior usava uma chave global do browser
// (`hivvo_onboarding_dismissed`, sem id), e isso produzia três defeitos de uma vez:
// a segunda conta do mesmo browser nascia SEM guia; o mesmo usuário em outro
// browser recebia o guia de novo; e "Começar do zero" (POST /auth/reset-data)
// zerava os dados mas NÃO trazia o guia de volta — o pior caso, porque é
// exatamente aí que a conta volta a precisar dele.
//
// A chave legada é APAGADA, não migrada: ela não pode ser atribuída a usuário
// nenhum (foi escrita sem id), então herdá-la significaria dar a dispensa de uma
// conta para outra — o defeito que este módulo existe para fechar. O custo de
// apagar é pequeno e limitado: com a condição nova, o banner só reaparece para
// quem de fato tem passo em aberto, e continua dispensável em um clique.
const PREFIXO = 'hivvo_onboarding_dismissed'
const CHAVE_LEGADA = PREFIXO

function chave(usuarioId: number): string {
  return `${PREFIXO}:${usuarioId}`
}

// `usuarioId` null = auth ainda não resolveu. Nunca "dispensado" nesse estado: o
// banner só monta dentro de rota protegida, e errar para o lado de MOSTRAR é o
// lado recuperável (o usuário fecha), enquanto errar para o lado de esconder
// deixa alguém sem guia sem nunca saber que havia um.
export function onboardingDispensado(usuarioId: number | null): boolean {
  if (usuarioId == null) return false
  localStorage.removeItem(CHAVE_LEGADA)
  return localStorage.getItem(chave(usuarioId)) === '1'
}

export function dispensarOnboarding(usuarioId: number | null): void {
  if (usuarioId == null) return
  localStorage.setItem(chave(usuarioId), '1')
}

// Chamado pelo "Começar do zero": a conta volta ao estado inicial, o guia também.
export function restaurarOnboarding(usuarioId: number | null): void {
  if (usuarioId == null) return
  localStorage.removeItem(chave(usuarioId))
}
