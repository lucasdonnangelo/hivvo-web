import { useBreakpoint } from '../../hooks/useBreakpoint'
import { useCoverage } from '../../hooks/useStatistics'
import Section1Detail from './Section1Detail'
import Section2Comparison from './Section2Comparison'

// ─── aba Análise ──────────────────────────────────────────────────────────────
//
// A sub-navegação vive no DashboardPage; aqui ficam as três seções, decididas
// pelo florescimento (/coverage). Seções 2 e 3 ainda são casca (placeholder/
// convite) — o conteúdo vem nos próximos batches.
//
// Florescimento:
//  • Seção 1 "Este mês em detalhe": SEMPRE presente (reflete o mês corrente, NÃO
//    o histórico — NÃO depende do coverage; gerencia o próprio load e o próprio
//    vazio). Já implementada (Section1Detail).
//  • Seção 2 "Comparação": presente com ≥2 meses de dados.
//  • Seção 3 "Evolução":  presente com ≥3 meses de dados.

// ─── sub-components ─────────────────────────────────────────────────────────

// Slot de uma seção PRESENTE. Placeholder rotulado: nomeia a seção e descreve o
// que ela vai mostrar (cria expectativa) — recebe o conteúdo real no próximo batch.
function SectionPlaceholder({
  title,
  description,
  isMobile,
}: {
  title: string
  description: string
  isMobile: boolean
}) {
  return (
    <div className={`bg-bg-surface rounded-lg ${isMobile ? 'p-4' : 'p-6'}`}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-text-primary">{title}</h2>
        <span className="text-[10px] font-medium text-text-muted bg-bg rounded-full px-2 py-0.5">
          Em breve
        </span>
      </div>
      <p className="text-text-muted text-sm">{description}</p>
    </div>
  )
}

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

          {/* Seção 3 — Evolução (floresce com ≥3 meses de dados). */}
          {meses >= 3 ? (
            <SectionPlaceholder
              title="Evolução"
              description="Seus gastos e receitas ao longo dos meses."
              isMobile={isMobile}
            />
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
