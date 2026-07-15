/**
 * Recuperação de chunk defasado pós-deploy.
 *
 * A cada deploy os chunks trocam de hash e a Vercel para de servir os antigos.
 * Uma aba aberta no bundle anterior que navega para uma rota lazy pede um
 * arquivo que não existe mais → 404 → o import() rejeita → "Failed to fetch
 * dynamically imported module". O Vite despacha `vite:preloadError` exatamente
 * nesse caso — e SÓ quando um import() real executa (navegação de rota); os
 * <link rel="modulepreload"> do HTML não passam por aqui.
 *
 * A recuperação é UM reload: o SW novo (que é quem purgou o chunk velho do
 * precache — enquanto o SW velho controla, o precache antigo está intacto e
 * serve o chunk) responde a navegação com o index.html novo, e o app volta na
 * mesma URL já na versão nova.
 *
 * Contra loop de reload — pior que a tela de erro — a janela em sessionStorage:
 * no máximo um reload automático por minuto. Se o reload não resolver (falha de
 * rede persistente, deploy quebrado), o segundo erro NÃO é interceptado e sobe
 * para o ErrorBoundary, que mostra "Algo deu errado" + botão Recarregar.
 */
import * as Sentry from '@sentry/react'

const FLAG_KEY = 'hivvo:stale-chunk-reload-at'
const JANELA_MS = 60_000

/**
 * Registra o timestamp do reload e diz se ele pode acontecer.
 *
 * Sem sessionStorage (modo privado restrito) não há como detectar o loop entre
 * reloads, então não recarrega nunca — o ErrorBoundary assume.
 */
function podeRecarregar(): boolean {
  try {
    const ultimo = Number(sessionStorage.getItem(FLAG_KEY) ?? 0)
    if (Date.now() - ultimo < JANELA_MS) return false
    sessionStorage.setItem(FLAG_KEY, String(Date.now()))
    return true
  } catch {
    return false
  }
}

export function installStaleChunkReload(): void {
  window.addEventListener('vite:preloadError', (event) => {
    if (!podeRecarregar()) return // deixa subir para o ErrorBoundary

    // preventDefault impede o throw do helper do Vite: sem ele o erro chegaria
    // ao ErrorBoundary e a tela de erro piscaria durante o reload.
    event.preventDefault()

    // Melhor esforço: se o transporte não completar antes do reload, perde-se o
    // aviso, não a recuperação. Sem DSN é no-op. A mensagem é fixa e a URL do
    // chunk não carrega dado de usuário.
    Sentry.captureMessage(
      `chunk defasado pós-deploy, recarregando: ${event.payload.message}`,
      'warning'
    )

    window.location.reload()
  })
}
