// Construção do patch de PUT /auth/me.
//
// Isto existe como função pura por um motivo específico, e não por arrumação:
// o valor que a tela mais manda é `false`, e `false` é o valor que some. Um
// `if (valor)` ou um `{ ...(valor && { campo: valor }) }` — as duas formas mais
// naturais de montar payload condicional em JS — DESCARTAM `false` e mandam um
// objeto vazio. O backend responde 422 ("informe ao menos um campo") e o toggle
// simplesmente não desliga, com a UI já mostrando desligado.
//
// O bug é invisível no caminho de LIGAR, que é o que se testa primeiro à mão.

export interface PatchPerfil {
  nome_completo?: string
  notificar_vencimento?: boolean
}

/** Patch de uma preferência booleana — `false` viaja igual a `true`. */
export function patchNotificarVencimento(valor: boolean): PatchPerfil {
  return { notificar_vencimento: valor }
}

/**
 * O estado que o toggle deve mostrar.
 *
 * `undefined` acontece de verdade: entre o boot e o `getMe()` do App.tsx o
 * store não tem usuário. Cair para LIGADO nesse instante espelharia o default
 * do backend — mas mostraria "ligado" para quem desligou, e o primeiro clique
 * de quem visse isso mandaria `false` de novo, sem efeito aparente. Ficar
 * indefinido (e a UI desabilitar o controle) é o único estado honesto.
 */
export function estadoDoToggle(valor: boolean | undefined): {
  ligado: boolean
  carregando: boolean
} {
  if (valor === undefined) return { ligado: false, carregando: true }
  return { ligado: valor, carregando: false }
}
