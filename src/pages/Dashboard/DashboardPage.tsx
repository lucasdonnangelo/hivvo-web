import { useState } from 'react'
import { useBreakpoint } from '../../hooks/useBreakpoint'
import OverviewPage from './OverviewPage'
import AnalysisPage from './AnalysisPage'

// ─── container das abas do "Início" ───────────────────────────────────────────
//
// DashboardPage é só a NAVEGAÇÃO: gerencia a aba ativa e renderiza o conteúdo.
// Duas metades da história temporal do dinheiro:
//  • "Visão geral" (OverviewPage) = presente + futuro (o Dashboard de sempre).
//  • "Análise" (AnalysisPage)     = passado + análise (o Resumo).
// Aba ativa é UI-state local: não persiste entre sessões, sempre abre em Visão geral.

type DashboardTab = 'overview' | 'analysis'

const TABS: { key: DashboardTab; label: string }[] = [
  { key: 'overview', label: 'Visão geral' },
  { key: 'analysis', label: 'Análise' },
]

// Segmented control no padrão do ViewToggle dos Cartões. Full-width no mobile
// (alvos de toque maiores), largura natural no desktop — tudo via useBreakpoint.
function TabNav({
  value,
  onChange,
  isMobile,
}: {
  value: DashboardTab
  onChange: (v: DashboardTab) => void
  isMobile: boolean
}) {
  return (
    <div
      className={[
        'rounded-md bg-bg-surface p-0.5 border border-bg-border',
        isMobile ? 'flex' : 'inline-flex',
      ].join(' ')}
    >
      {TABS.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => onChange(t.key)}
          className={[
            'px-4 py-1.5 rounded text-sm font-medium transition-colors',
            isMobile ? 'flex-1' : '',
            value === t.key
              ? 'bg-amber text-bg'
              : 'text-text-muted hover:text-text-primary',
          ].join(' ')}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

export default function DashboardPage() {
  const isMobile = useBreakpoint('md')
  const [tab, setTab] = useState<DashboardTab>('overview')

  return (
    <div className="flex flex-col">
      <div className={isMobile ? 'px-4 pt-4' : 'px-6 pt-6'}>
        <TabNav value={tab} onChange={setTab} isMobile={isMobile} />
      </div>

      {tab === 'overview' ? <OverviewPage /> : <AnalysisPage />}
    </div>
  )
}
