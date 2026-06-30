import Spinner from './Spinner'

// Fallback de Suspense para rotas lazy (FE-11). Renderiza DENTRO do shell
// (MobileLayout/DesktopLayout/AuthLayout) — preenche a área de conteúdo sem
// substituir a navegação. Nunca retorna null/tela branca.
export default function RouteFallback() {
  return (
    <div className="flex items-center justify-center h-full min-h-[40vh] text-text-muted">
      <Spinner size={28} />
    </div>
  )
}
