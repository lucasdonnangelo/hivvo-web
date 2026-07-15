import type { ReactNode } from 'react'
import * as Sentry from '@sentry/react'
import Button from './ui/Button'

/**
 * Fallback de erro de render.
 *
 * Não mostra `error.message`: a mensagem da exceção é o único campo que o scrub
 * do observability.ts não consegue filtrar por deny-all (ela É o erro), então
 * pode conter dado de transação. O que o usuário precisa é do eventId, que
 * amarra o relato ao evento no Sentry.
 */
function ErrorFallback({ eventId }: { eventId: string }) {
  return (
    <div className="w-full flex flex-col items-center text-center px-6 pt-24 pb-16">
      <div className="w-16 h-16 rounded-full bg-bg-surface flex items-center justify-center mb-5">
        <span className="text-amber text-3xl">!</span>
      </div>
      <h2 className="text-text-primary text-lg font-semibold">Algo deu errado</h2>
      <p className="text-text-muted text-sm mt-2 max-w-xs">
        A tela não pôde ser exibida. Recarregar costuma resolver — seus dados estão salvos.
      </p>
      {eventId && (
        <p className="text-text-muted text-xs mt-3 font-mono">
          Código do erro: {eventId.slice(0, 8)}
        </p>
      )}
      <div className="mt-6 w-full max-w-[220px]">
        <Button onClick={() => window.location.reload()}>Recarregar</Button>
      </div>
    </div>
  )
}

/**
 * ErrorBoundary da app.
 *
 * Envolve as rotas: um erro de render vira relatório no Sentry + tela de
 * recuperação, em vez de tela branca. Sem DSN, o `captureException` interno do
 * Sentry é no-op e só o fallback aparece — o boundary funciona igual em dev.
 */
export default function ErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <Sentry.ErrorBoundary fallback={({ eventId }) => <ErrorFallback eventId={eventId} />}>
      {children}
    </Sentry.ErrorBoundary>
  )
}
