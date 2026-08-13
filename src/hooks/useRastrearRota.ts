import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { registrarRota } from '../lib/rotaAnterior'

/**
 * Alimenta lib/rotaAnterior a cada navegação. Chamado UMA vez, no AppLayout —
 * de lá cobre todas as rotas autenticadas, que são as que interessam ao
 * feedback.
 *
 * `useLocation().pathname` e não `location.href`: o pathname já vem sem query
 * nem hash, que é exatamente o que não pode ser guardado (o `?token=` do reset
 * de senha é o caso concreto documentado em lib/observability.ts).
 */
export function useRastrearRota(): void {
  const { pathname } = useLocation()
  useEffect(() => {
    registrarRota(pathname)
  }, [pathname])
}
