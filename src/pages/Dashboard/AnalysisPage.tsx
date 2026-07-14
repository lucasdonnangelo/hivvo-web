import { useBreakpoint } from '../../hooks/useBreakpoint'
import { useCoverage } from '../../hooks/useStatistics'
import Section1Detail from './Section1Detail'
import Section2Comparison from './Section2Comparison'
import Section3Evolution from './Section3Evolution'

// ─── aba Análise ──────────────────────────────────────────────────────────────
//
// A sub-navegação vive no DashboardPage; aqui ficam as três seções, decididas
// pelo florescimento (/coverage). Todas com conteúdo real; onde ainda não
// floresceu (2 e 3), um convite discreto ocupa o lugar.
//
// Florescimento:
//  • Seção 1 "Este mês em detalhe": SEMPRE presente (reflete o mês corrente, NÃO
//    o histórico — NÃO depende do coverage; gerencia o próprio load e o próprio
//    vazio). (Section1Detail)
//  • Seção 2 "Comparação": presente com ≥2 meses de dados. (Section2Comparison)
//  • Seção 3 "Evolução":  presente com ≥6 meses de dados (série temporal precisa
//    de base consistente — lição XP; ver PLANO_RESUMO). (Section3Evolution)

// ─── sub-components ─────────────────────────────────────────────────────────

// Slot de uma seção AUSENTE (ainda não floresceu). Convite discreto e acolhedor —
// ensina que a seção existe e cria expectativa, sem parecer um erro ou bloqueio.
// Mantém o rótulo para o usuário aprender o nome do que está por vir.
function SectionInvite({
  title,
  message,
  isMobile,
}: {
  title: string
  message: string
  isMobile: boolean
}) {
  return (
    <div className={`bg-bg-surface rounded-lg ${isMobile ? 'p-4' : 'p-6'}`}>
      <h2 className="text-sm font-medium text-text-primary mb-3">{title}</h2>
      <div className="flex flex-col items-center text-center py-6">
        <div className="w-11 h-11 rounded-full bg-bg flex items-center justify-center mb-3">
          <span className="text-amber text-lg">◇</span>
        </div>
        <p className="text-text-muted text-sm max-w-xs">{message}</p>
      </div>
    </div>
  )
}

// Skeleton dos slots governados pelo coverage (Seções 2 e 3) enquanto ele carrega
// — evita o flash de "nada". A Seção 1 NÃO espera o coverage (renderiza já, com o
// próprio load).
function CoverageSlotsSkeleton() {
  return (
    <>
      <div className="h-44 bg-bg-surface rounded-lg animate-pulse" />
      <div className="h-44 bg-bg-surface rounded-lg animate-pulse" />
    </>
  )
}

// ─── page ────────────────────────────────────────────────────────────────────

export default function AnalysisPage() {
  const isMobile = useBreakpoint('md')
  const { data: coverage, isLoading: coverageLoading } = useCoverage()

  // Erro/sem dado degrada para 0 → convites nas Seções 2 e 3. Nunca bloqueia.
  const meses = coverage?.meses_com_dados ?? 0

  return (
    <div className={`flex flex-col gap-4 ${isMobile ? 'p-4' : 'p-6'}`}>
      {/* Seção 1 — sempre presente (mês corrente, independe do coverage). Renderiza
          de imediato e gerencia o próprio load/vazio. */}
      <Section1Detail isMobile={isMobile} />

      {/* Seções 2 e 3 — governadas pelo coverage; skeleton enquanto ele carrega. */}
      {coverageLoading ? (
        <CoverageSlotsSkeleton />
      ) : (
        <>
          {/* Seção 2 — Comparação (floresce com ≥2 meses de dados). */}
          {meses >= 2 ? (
            <Section2Comparison coverage={meses} isMobile={isMobile} />
          ) : (
            <SectionInvite
              title="Comparação"
              message="Sua comparação mensal aparecerá com mais um mês de uso."
              isMobile={isMobile}
            />
          )}

          {/* Seção 3 — Evolução (floresce com ≥6 meses de dados). */}
          {meses >= 6 ? (
            <Section3Evolution coverage={meses} isMobile={isMobile} />
          ) : (
            <SectionInvite
              title="Evolução"
              message="Sua evolução aparecerá conforme você usar o app."
              isMobile={isMobile}
            />
          )}
        </>
      )}
    </div>
  )
}
