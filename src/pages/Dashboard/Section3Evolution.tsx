import { useState } from 'react'
import { useEvolution, useEvolutionCategories } from '../../hooks/useStatistics'
import EvolutionChart, { type EvoSeries } from '../../components/charts/EvolutionChart'

// ─── Seção 3 "Evolução" ───────────────────────────────────────────────────────
//
// Aparece com coverage ≥ 6 (base consistente p/ série temporal — lição XP: poucos
// meses distorcem por eventos iniciais atípicos). Dois gráficos SEPARADOS (eixos e
// semânticas diferentes): o principal (despesas vs receitas) e o de categoria (uma
// por vez). Base CONSUMO. Valores em R$, nunca %. O mês corrente é PARCIAL (tratado
// no EvolutionChart: último segmento tracejado + anel).

const COLOR_RECEITA = '#3DBF7F'
const COLOR_DESPESA = '#E85D5D'
const COLOR_CATEGORIA = '#EF9F27' // amber — acento de "seleção em foco"

// Filtro de horizonte que FLORESCE: passos fixos [3,6,12] limitados ao histórico
// (passo ≤ coverage) + "Tudo" = min(coverage, 60). Nunca oferece horizonte maior
// que o histórico (plotaria meses vazios que enganam — lição XP no filtro).
const HORIZON_STEPS = [3, 6, 12]

interface HorizonOption {
  key: string
  label: string
  meses: number
}

function buildHorizonOptions(coverage: number): HorizonOption[] {
  const opts: HorizonOption[] = HORIZON_STEPS.filter((s) => s <= coverage).map((s) => ({
    key: String(s),
    label: String(s),
    meses: s,
  }))
  opts.push({ key: 'tudo', label: 'Tudo', meses: Math.min(coverage, 60) })
  return opts
}

function ChartSkeleton() {
  return <div className="h-56 bg-bg rounded-lg animate-pulse" />
}

// ─── section ─────────────────────────────────────────────────────────────────

export default function Section3Evolution({
  coverage,
  isMobile,
}: {
  coverage: number
  isMobile: boolean
}) {
  const options = buildHorizonOptions(coverage)
  // Estado local (não persiste): default = "6" (sempre disponível, pois coverage ≥ 6).
  const [horizonKey, setHorizonKey] = useState('6')
  const active = options.find((o) => o.key === horizonKey) ?? options[0]
  const meses = active.meses

  // Categoria selecionada no 2º gráfico (uma por vez).
  const [selectedCat, setSelectedCat] = useState<string | null>(null)

  const { data: evo, isLoading: evoLoading, isError: evoError } = useEvolution(meses)
  const { data: evoCats, isLoading: catsLoading } = useEvolutionCategories(meses)

  const pad = isMobile ? 'p-4' : 'p-6'
  const chartHeight = isMobile ? 200 : 240

  // Gráfico principal — duas séries.
  const mainAxis = evo?.series.map((m) => ({ mes: m.mes, ano: m.ano })) ?? []
  const mainSeries: EvoSeries[] = evo
    ? [
        { key: 'receitas', label: 'Receitas', color: COLOR_RECEITA, values: evo.series.map((m) => m.receitas) },
        { key: 'despesas', label: 'Despesas', color: COLOR_DESPESA, values: evo.series.map((m) => m.despesas) },
      ]
    : []

  // Gráfico de categoria — uma série (a selecionada; cai na 1ª se a escolhida sumir
  // ao trocar horizonte).
  const cats = evoCats?.categorias ?? []
  const activeCat = cats.find((c) => c.categoria === selectedCat) ?? cats[0]
  const catAxis = evoCats?.meses ?? []
  const catSeries: EvoSeries[] = activeCat
    ? [{ key: 'cat', label: activeCat.categoria, color: COLOR_CATEGORIA, values: activeCat.serie }]
    : []

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-medium text-text-primary">Evolução</h2>
        <p className="text-sm text-text-muted">
          {active.key === 'tudo' ? `Todo o histórico (${meses} meses)` : `Últimos ${meses} meses`}
        </p>
      </div>

      {/* Filtro de horizonte (floresce com o coverage). */}
      <div className="inline-flex self-start rounded-md bg-bg-surface p-0.5 border border-bg-border">
        {options.map((o) => (
          <button
            key={o.key}
            type="button"
            onClick={() => setHorizonKey(o.key)}
            className={[
              'px-3 py-1 rounded text-xs font-medium transition-colors',
              horizonKey === o.key ? 'bg-amber text-bg' : 'text-text-muted hover:text-text-primary',
            ].join(' ')}
          >
            {o.label}
          </button>
        ))}
      </div>

      {/* Gráfico principal — despesas vs receitas. */}
      <div className={`bg-bg-surface rounded-lg ${pad}`}>
        <h3 className="text-sm font-medium text-text-primary mb-3">Despesas e receitas</h3>
        {evoLoading ? (
          <ChartSkeleton />
        ) : evoError || !evo ? (
          <p className="text-text-muted text-sm">Não foi possível carregar a evolução. Tente novamente.</p>
        ) : (
          <EvolutionChart axis={mainAxis} series={mainSeries} height={chartHeight} />
        )}
      </div>

      {/* Gráfico de categoria — SEPARADO, seletor de uma categoria por vez. */}
      <div className={`bg-bg-surface rounded-lg ${pad}`}>
        <h3 className="text-sm font-medium text-text-primary mb-1">Evolução por categoria</h3>
        <p className="text-xs text-text-muted mb-3">Escolha uma categoria</p>

        {catsLoading ? (
          <ChartSkeleton />
        ) : cats.length === 0 ? (
          <p className="text-text-muted text-sm">Sem despesas no período.</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 mb-4">
              {cats.map((c) => (
                <button
                  key={c.categoria}
                  type="button"
                  onClick={() => setSelectedCat(c.categoria)}
                  className={[
                    'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                    activeCat?.categoria === c.categoria
                      ? 'bg-amber border-amber text-bg'
                      : 'bg-bg border-bg-border text-text-muted hover:border-text-muted',
                  ].join(' ')}
                >
                  {c.categoria}
                </button>
              ))}
            </div>
            <EvolutionChart axis={catAxis} series={catSeries} height={chartHeight} />
          </>
        )}
      </div>
    </section>
  )
}
