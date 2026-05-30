import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBreakpoint } from '../../hooks/useBreakpoint'
import {
  useMonthlyStats,
  useYearlyStats,
  useQuarterlyStats,
  useAnnualCategoryStats,
} from '../../hooks/useStatistics'
import { useInstallments } from '../../hooks/useInstallments'
import DonutChart from '../../components/charts/DonutChart'
import BarChart from '../../components/charts/BarChart'
import type { CategoriaStats, MesEvolucao } from '../../services/statistics'

// ─── constants ────────────────────────────────────────────────────────────────

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]
const MONTHS_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

type Periodo = 'mes' | 'trimestre' | 'ano'

// ─── helpers ─────────────────────────────────────────────────────────────────

const formatBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

function getQuarter(mes: number) {
  return Math.ceil(mes / 3)
}

function getQuarterStart(q: number) {
  return (q - 1) * 3 + 1
}

function calcVariacao(current: number, previous: number): number | null {
  if (previous === 0) return null
  return ((current - previous) / Math.abs(previous)) * 100
}

function formatVariacao(v: number | null): string | null {
  if (v == null) return null
  const sign = v > 0 ? '+' : ''
  return `${sign}${v.toFixed(1).replace('.', ',')}%`
}

// ─── period label ─────────────────────────────────────────────────────────────

function getPeriodLabel(periodo: Periodo, mes: number, ano: number): string {
  if (periodo === 'mes') return `${MONTHS[mes - 1]} ${ano}`
  if (periodo === 'trimestre') {
    const q = getQuarter(mes)
    const start = getQuarterStart(q)
    return `T${q} ${ano} (${MONTHS_SHORT[start - 1]}–${MONTHS_SHORT[start + 1]})`
  }
  return String(ano)
}

// ─── sub-components ──────────────────────────────────────────────────────────

interface MetricCardProps {
  label: string
  value: number
  color: 'neutral' | 'success' | 'danger' | 'amber'
  variacao?: number | null
  variacaoInverted?: boolean
  sublabel?: string
}

function MetricCard({
  label,
  value,
  color,
  variacao,
  variacaoInverted = false,
  sublabel,
}: MetricCardProps) {
  const valueClass =
    color === 'success' ? 'text-success' :
    color === 'danger'  ? 'text-danger'  :
    color === 'amber'   ? 'text-amber'   :
    'text-text-primary'

  const variacaoText = formatVariacao(variacao ?? null)
  const variacaoClass =
    variacao == null ? '' :
    variacaoInverted
      ? variacao > 0 ? 'text-danger' : 'text-success'
      : variacao > 0 ? 'text-success' : 'text-danger'

  return (
    <div className="bg-bg-surface rounded-lg p-4 flex flex-col gap-1">
      <p className="text-xs text-text-muted">{label}</p>
      <p className={`text-xl font-medium ${valueClass}`}>{formatBRL(value)}</p>
      {variacaoText && (
        <p className={`text-xs ${variacaoClass}`}>{variacaoText} vs período ant.</p>
      )}
      {sublabel && !variacaoText && (
        <p className="text-xs text-text-muted">{sublabel}</p>
      )}
    </div>
  )
}

// ─── top categories with progress bar ────────────────────────────────────────

const CHART_COLORS_BG = [
  'bg-amber',
  'bg-success',
  'bg-danger',
  'bg-amber-light',
  'bg-amber-dark',
  'bg-text-muted',
]

function TopCategorias({ categorias }: { categorias: CategoriaStats[] }) {
  if (categorias.length === 0) {
    return (
      <p className="text-text-muted text-sm py-4 text-center">Sem categorias para exibir.</p>
    )
  }

  const top = categorias.slice(0, 6)

  return (
    <div className="flex flex-col gap-3">
      {top.map((cat, i) => (
        <div key={cat.categoria}>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2 min-w-0">
              <div
                className={`w-2 h-2 rounded-full shrink-0 ${CHART_COLORS_BG[i % CHART_COLORS_BG.length]}`}
              />
              <span className="text-sm text-text-primary truncate">{cat.categoria}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-3">
              <span className="text-xs text-text-muted">
                {Number(cat.percentual).toFixed(1).replace('.', ',')}%
              </span>
              <span className="text-sm font-medium text-text-primary">{formatBRL(cat.total)}</span>
            </div>
          </div>
          <div className="h-1.5 bg-bg-border rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${CHART_COLORS_BG[i % CHART_COLORS_BG.length]}`}
              style={{ width: `${Math.min(cat.percentual, 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ isMobile }: { isMobile: boolean }) {
  if (isMobile) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <div className="h-10 bg-bg-surface rounded-lg animate-pulse" />
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 bg-bg-surface rounded-lg animate-pulse" />
          ))}
        </div>
        <div className="h-64 bg-bg-surface rounded-lg animate-pulse" />
        <div className="h-52 bg-bg-surface rounded-lg animate-pulse" />
        <div className="h-48 bg-bg-surface rounded-lg animate-pulse" />
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="h-10 w-72 bg-bg-surface rounded-lg animate-pulse" />
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 bg-bg-surface rounded-lg animate-pulse" />
        ))}
      </div>
      <div className="grid grid-cols-[45%_1fr] gap-4">
        <div className="h-80 bg-bg-surface rounded-lg animate-pulse" />
        <div className="h-80 bg-bg-surface rounded-lg animate-pulse" />
      </div>
      <div className="h-52 bg-bg-surface rounded-lg animate-pulse" />
    </div>
  )
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function SummaryPage() {
  const isMobile = useBreakpoint('md')
  const navigate = useNavigate()
  const now = new Date()

  const [periodo, setPeriodo] = useState<Periodo>('mes')
  const [mes, setMes]         = useState(now.getMonth() + 1)
  const [ano, setAno]         = useState(now.getFullYear())

  const isCurrentPeriod = useMemo(() => {
    if (periodo === 'mes') return mes === now.getMonth() + 1 && ano === now.getFullYear()
    if (periodo === 'trimestre') {
      const currentQ = getQuarter(now.getMonth() + 1)
      const selectedQ = getQuarter(mes)
      return selectedQ === currentQ && ano === now.getFullYear()
    }
    return ano === now.getFullYear()
  }, [periodo, mes, ano, now])

  // ── navigation ──────────────────────────────────────────────────────────────

  const goPrev = () => {
    if (periodo === 'mes') {
      if (mes === 1) { setMes(12); setAno((a) => a - 1) }
      else setMes((m) => m - 1)
    } else if (periodo === 'trimestre') {
      const q = getQuarter(mes)
      if (q === 1) { setMes(10); setAno((a) => a - 1) }
      else setMes(getQuarterStart(q - 1))
    } else {
      setAno((a) => a - 1)
    }
  }

  const goNext = () => {
    if (isCurrentPeriod) return
    if (periodo === 'mes') {
      if (mes === 12) { setMes(1); setAno((a) => a + 1) }
      else setMes((m) => m + 1)
    } else if (periodo === 'trimestre') {
      const q = getQuarter(mes)
      if (q === 4) { setMes(1); setAno((a) => a + 1) }
      else setMes(getQuarterStart(q + 1))
    } else {
      setAno((a) => a + 1)
    }
  }

  const onPeriodoChange = (p: Periodo) => {
    setPeriodo(p)
    // Snap month to quarter start when switching to trimestre
    if (p === 'trimestre') {
      const q = getQuarter(mes)
      setMes(getQuarterStart(q))
    }
  }

  // ── next month for installments ─────────────────────────────────────────────

  const nextMes = mes === 12 ? 1 : mes + 1
  const nextAno = mes === 12 ? ano + 1 : ano
  const { data: nextInstallments = [] } = useInstallments(nextMes, nextAno)
  const parcelasProxMes = useMemo(
    () => nextInstallments.filter((p) => !p.pago && !p.cancelado).reduce((sum, p) => sum + parseFloat(p.valor), 0),
    [nextInstallments],
  )

  // ── data fetching by period ─────────────────────────────────────────────────

  const quarterStart = getQuarterStart(getQuarter(mes))

  const monthly      = useMonthlyStats(mes, ano)
  const quarterly    = useQuarterlyStats(quarterStart, ano)
  const yearly       = useYearlyStats(ano)
  const prevYearly   = useYearlyStats(ano - 1)

  // Aggregate categories across all 12 months client-side (avoids month-scoped endpoint returning empty)
  const annualCategories = useAnnualCategoryStats(ano)

  // ── derived stats ───────────────────────────────────────────────────────────

  const { metrics, categorias, isLoading, isEmpty } = useMemo(() => {
    if (periodo === 'mes') {
      const d = monthly.data
      const loading = monthly.isLoading
      if (!d) return { metrics: null, categorias: [], isLoading: loading, isEmpty: false }
      return {
        metrics: {
          receitas: d.receitas,
          despesas: d.despesas,
          saldo: d.saldo,
          variacao_receitas: d.variacao_receitas,
          variacao_despesas: d.variacao_despesas,
        },
        categorias: d.categorias,
        isLoading: loading,
        isEmpty: d.receitas === 0 && d.despesas === 0,
      }
    }

    if (periodo === 'trimestre') {
      const d = quarterly.data
      const loading = quarterly.isLoading
      if (!d) return { metrics: null, categorias: [], isLoading: loading, isEmpty: false }

      // Previous quarter for comparison
      const prevQ = getQuarter(mes) === 1
        ? { qStart: 10, ano: ano - 1 }
        : { qStart: getQuarterStart(getQuarter(mes) - 1), ano }

      return {
        metrics: {
          receitas: d.receitas,
          despesas: d.despesas,
          saldo: d.saldo,
          // Comparison not available without previous quarter fetch — shown as null
          variacao_receitas: null as number | null,
          variacao_despesas: null as number | null,
          _prevQ: prevQ,
        },
        categorias: d.categorias,
        isLoading: loading,
        isEmpty: d.receitas === 0 && d.despesas === 0,
      }
    }

    // Ano
    const d = yearly.data
    const loading = yearly.isLoading || annualCategories.isLoading
    if (!d) return { metrics: null, categorias: [], isLoading: loading, isEmpty: false }

    const totalReceitas = d.meses.reduce((s, m) => s + m.receitas, 0)
    const totalDespesas = d.meses.reduce((s, m) => s + m.despesas, 0)
    const totalSaldo    = totalReceitas - totalDespesas

    const prevAnoData = prevYearly.data
    const prevReceitas = prevAnoData?.meses.reduce((s, m) => s + m.receitas, 0) ?? 0
    const prevDespesas = prevAnoData?.meses.reduce((s, m) => s + m.despesas, 0) ?? 0

    return {
      metrics: {
        receitas: totalReceitas,
        despesas: totalDespesas,
        saldo: totalSaldo,
        variacao_receitas: prevAnoData ? calcVariacao(totalReceitas, prevReceitas) : null,
        variacao_despesas: prevAnoData ? calcVariacao(totalDespesas, prevDespesas) : null,
      },
      categorias: annualCategories.data?.categorias ?? [],
      isLoading: loading,
      isEmpty: totalReceitas === 0 && totalDespesas === 0,
    }
  }, [periodo, monthly, quarterly, yearly, annualCategories, prevYearly, mes, ano])

  // ── bar chart data ──────────────────────────────────────────────────────────

  const barData: MesEvolucao[] = useMemo(() => {
    if (!yearly.data) return []
    if (periodo === 'trimestre') {
      const q = getQuarter(mes)
      const start = getQuarterStart(q)
      return yearly.data.meses.filter((m) => m.mes >= start && m.mes <= start + 2)
    }
    return yearly.data.meses
  }, [yearly.data, periodo, mes])

  const highlightMeses = useMemo(() => {
    if (periodo === 'mes') return [mes]
    if (periodo === 'trimestre') {
      const q = getQuarter(mes)
      const s = getQuarterStart(q)
      return [s, s + 1, s + 2]
    }
    return undefined
  }, [periodo, mes])

  // ─── loading ────────────────────────────────────────────────────────────────

  if (isLoading && !metrics) return <Skeleton isMobile={isMobile} />

  // ─── shared UI elements ──────────────────────────────────────────────────────

  const periodToggle = (
    <div className="flex items-center bg-bg-surface rounded-lg p-1 gap-1">
      {(['mes', 'trimestre', 'ano'] as Periodo[]).map((p) => (
        <button
          key={p}
          onClick={() => onPeriodoChange(p)}
          className={[
            'flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
            periodo === p
              ? 'bg-amber text-bg'
              : 'text-text-muted hover:text-text-primary',
          ].join(' ')}
        >
          {p === 'mes' ? 'Mês' : p === 'trimestre' ? 'Trimestre' : 'Ano'}
        </button>
      ))}
    </div>
  )

  const periodNav = (
    <div className="flex items-center gap-2">
      <button
        onClick={goPrev}
        className="w-8 h-8 flex items-center justify-center rounded-md text-text-muted hover:text-text-primary hover:bg-bg-surface transition-colors"
        aria-label="Período anterior"
      >
        ‹
      </button>
      <span className="text-sm font-medium text-text-primary whitespace-nowrap">
        {getPeriodLabel(periodo, mes, ano)}
      </span>
      <button
        onClick={goNext}
        disabled={isCurrentPeriod}
        className="w-8 h-8 flex items-center justify-center rounded-md text-text-muted hover:text-text-primary hover:bg-bg-surface transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        aria-label="Próximo período"
      >
        ›
      </button>
    </div>
  )

  const exportBtn = (
    <button
      onClick={() => {/* placeholder */}}
      className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium text-text-muted border border-bg-border hover:text-text-primary hover:border-amber transition-colors"
    >
      ↑ Exportar
    </button>
  )

  const metricCards = metrics ? (
    <>
      <MetricCard
        label="Receitas"
        value={metrics.receitas}
        color="success"
        variacao={metrics.variacao_receitas}
      />
      <MetricCard
        label="Despesas"
        value={metrics.despesas}
        color="danger"
        variacao={metrics.variacao_despesas}
        variacaoInverted
      />
      <MetricCard
        label="Saldo Líquido"
        value={metrics.saldo}
        color={metrics.saldo >= 0 ? 'success' : 'danger'}
      />
      <MetricCard
        label="Parcelas — Próx. Mês"
        value={parcelasProxMes}
        color="amber"
        sublabel={`${MONTHS[nextMes - 1]} ${nextAno}`}
      />
    </>
  ) : null

  const emptyState = (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-12 h-12 rounded-full bg-bg-surface flex items-center justify-center mb-4">
        <span className="text-amber text-lg">◇</span>
      </div>
      <p className="text-text-primary font-medium">Sem movimentações</p>
      <p className="text-text-muted text-sm mt-1">
        Nenhuma transação em {getPeriodLabel(periodo, mes, ano)}
      </p>
    </div>
  )

  // ─── mobile ──────────────────────────────────────────────────────────────────

  if (isMobile) {
    return (
      <div className="flex flex-col h-full overflow-y-auto">
        {/* Header */}
        <div className="shrink-0 flex items-center gap-3 px-4 pt-4 pb-3 border-b border-bg-border">
          <button
            onClick={() => navigate('/transactions')}
            className="w-8 h-8 flex items-center justify-center rounded-md text-text-muted hover:text-text-primary hover:bg-bg-surface transition-colors"
            aria-label="Voltar"
          >
            ←
          </button>
          <h1 className="text-base font-medium text-text-primary flex-1">Resumo Detalhado</h1>
          {exportBtn}
        </div>

        <div className="flex flex-col gap-4 p-4">
          {/* Toggle + nav */}
          <div className="flex flex-col gap-3">
            {periodToggle}
            <div className="flex items-center justify-between">
              {periodNav}
            </div>
          </div>

          {isEmpty ? emptyState : (
            <>
              {/* Metric cards 2×2 */}
              <div className="grid grid-cols-2 gap-3">
                {metricCards}
              </div>

              {/* Donut chart */}
              <div className="bg-bg-surface rounded-lg p-4">
                <h2 className="text-sm font-medium text-text-primary mb-4">
                  Gastos por categoria
                </h2>
                <DonutChart data={categorias} />
              </div>

              {/* Bar chart */}
              {barData.length > 0 && (
                <div className="bg-bg-surface rounded-lg p-4">
                  <h2 className="text-sm font-medium text-text-primary mb-2">
                    Evolução mensal
                  </h2>
                  <BarChart data={barData} highlightMeses={highlightMeses} />
                </div>
              )}

              {/* Top categories */}
              <div className="bg-bg-surface rounded-lg p-4">
                <h2 className="text-sm font-medium text-text-primary mb-4">
                  Top categorias
                </h2>
                <TopCategorias categorias={categorias} />
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  // ─── desktop ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Top bar */}
      <div className="shrink-0 flex items-center gap-4 px-6 py-4 border-b border-bg-border">
        <button
          onClick={() => navigate('/transactions')}
          className="w-8 h-8 flex items-center justify-center rounded-md text-text-muted hover:text-text-primary hover:bg-bg-surface transition-colors"
          aria-label="Voltar"
        >
          ←
        </button>
        <h1 className="text-base font-medium text-text-primary">Resumo Detalhado</h1>
        <div className="w-56">{periodToggle}</div>
        {periodNav}
        <div className="ml-auto">{exportBtn}</div>
      </div>

      <div className="flex flex-col gap-5 p-6">
        {isEmpty ? emptyState : (
          <>
            {/* Metric cards — 4 columns */}
            <div className="grid grid-cols-4 gap-4">
              {metricCards}
            </div>

            {/* Charts row */}
            <div className="grid grid-cols-[45%_1fr] gap-4">
              <div className="bg-bg-surface rounded-lg p-6">
                <h2 className="text-sm font-medium text-text-primary mb-4">
                  Gastos por categoria
                </h2>
                <DonutChart data={categorias} />
              </div>

              <div className="bg-bg-surface rounded-lg p-6">
                <h2 className="text-sm font-medium text-text-primary mb-2">
                  Evolução mensal — {ano}
                </h2>
                {barData.length > 0
                  ? <BarChart data={barData} highlightMeses={highlightMeses} />
                  : <p className="text-text-muted text-sm pt-8 text-center">Sem dados para o período.</p>
                }
              </div>
            </div>

            {/* Top categories */}
            <div className="bg-bg-surface rounded-lg p-6">
              <h2 className="text-sm font-medium text-text-primary mb-5">Top categorias</h2>
              <TopCategorias categorias={categorias} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
