// De onde o usuário VINHA antes de abrir Configurações.
//
// O formulário de feedback mora em Configurações, então a rota ATUAL é sempre
// /settings e não informa nada. A anterior é a única pista de onde ele estava
// quando resolveu escrever — e o e-mail a rotula como pista, nunca como fato: o
// usuário pode ter passeado por três telas antes de chegar aqui.
//
// Estado de MÓDULO, e não contexto do React, porque quem lê é o formulário e
// quem escreve é o layout: um contexto acordaria toda a árvore a cada navegação
// para alimentar um campo que só é lido quando alguém clica em "Enviar".

export interface EstadoRota {
  anterior: string | null
  atual: string | null
}

export const ROTA_INICIAL: EstadoRota = { anterior: null, atual: null }

/**
 * Avança o estado com a rota que acabou de entrar.
 *
 * Repetir a MESMA rota não mexe em nada. Isso não é micro-otimização: um
 * `navigate(..., { replace: true })` para o mesmo path, ou um efeito que dispare
 * duas vezes (o StrictMode do React 19 faz isso em dev), tornaria `anterior`
 * igual a `atual` — e o e-mail diria "vinha de /settings", que é onde o
 * formulário está. A pista viraria ruído sem ninguém notar.
 */
export function proximaRota(estado: EstadoRota, nova: string): EstadoRota {
  if (nova === estado.atual) return estado
  return { anterior: estado.atual, atual: nova }
}

let estado: EstadoRota = ROTA_INICIAL

export function registrarRota(pathname: string): void {
  estado = proximaRota(estado, pathname)
}

/** null quando não houve navegação anterior — reload ou link direto em /settings. */
export function rotaAnterior(): string | null {
  return estado.anterior
}

/** Só para o harness e os testes: zera o estado de módulo entre cenários. */
export function resetarRotas(): void {
  estado = ROTA_INICIAL
}
