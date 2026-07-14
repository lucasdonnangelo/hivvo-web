import { Fragment } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

// Gráfico de LINHA da Seção 3 (Evolução) — reutilizado pelo gráfico principal
// (2 séries: receitas/despesas) e pelo de categoria (1 série). Valores em R$
// (nunca %). O MÊS CORRENTE é PARCIAL: o último segmento vira TRACEJADO e o ponto
// atual ganha um anel oco, para não parecer uma queda-tendência falsa (lição XP).

const MONTHS_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const MONTHS_FULL = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

// Tokens (hex — Recharts não aceita classes)
const SURFACE = '#2A2520'
const BORDER = '#3A3530'
const TEXT_PRIMARY = '#F5F0E8'
const TEXT_MUTED = '#888580'

const formatBRLCompact = (value: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)

const formatBRLFull = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

export interface EvoSeries {
  key: string
  label: string
  color: string
  values: number[] // alinhado por índice ao eixo
}

interface MesAno {
  mes: number
  ano: number
}

type ChartRow = Record<string, number | string | boolean | null>

// Dot do último ponto (mês corrente): anel oco. Nos demais índices, nada — o dot
// dos meses fechados vem da linha sólida.
function makeLastDot(color: string, lastIndex: number) {
  return function LastDot(props: { cx?: number; cy?: number; index?: number }) {
    const { cx, cy, index } = props
    if (index !== lastIndex || cx == null || cy == null) return <g key={`e${index}`} />
    return (
      <circle key={`d${index}`} cx={cx} cy={cy} r={4} fill={SURFACE} stroke={color} strokeWidth={2} />
    )
  }
}

function EvoTooltip({
  active,
  payload,
  series,
}: {
  active?: boolean
  payload?: { payload: ChartRow }[]
  series: EvoSeries[]
}) {
  if (!active || !payload || payload.length === 0) return null
  const row = payload[0].payload
  return (
    <div
      style={{
        backgroundColor: SURFACE,
        border: `1px solid ${BORDER}`,
        borderRadius: 8,
        padding: '8px 10px',
        fontSize: 12,
      }}
    >
      <p style={{ color: TEXT_PRIMARY, margin: '0 0 4px', fontWeight: 500 }}>
        {row.fullLabel as string}
        {row.partial ? ' · parcial' : ''}
      </p>
      {series.map((s) => (
        <p key={s.key} style={{ color: s.color, margin: '2px 0' }}>
          {s.label}:{' '}
          <span style={{ color: TEXT_PRIMARY }}>{formatBRLFull((row[`${s.key}Raw`] as number) ?? 0)}</span>
        </p>
      ))}
    </div>
  )
}

interface EvolutionChartProps {
  axis: MesAno[]
  series: EvoSeries[]
  height?: number
}

export default function EvolutionChart({ axis, series, height = 220 }: EvolutionChartProps) {
  if (axis.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-text-muted text-sm">
        Sem dados para exibir
      </div>
    )
  }

  const n = axis.length

  // Sólido cobre os meses fechados (0..n-2); tracejado cobre só o último segmento
  // (n-2..n-1) → o mês corrente parcial. `*Raw` guarda o valor cheio p/ o tooltip.
  const data: ChartRow[] = axis.map((a, i) => {
    const row: ChartRow = {
      label: MONTHS_SHORT[a.mes - 1],
      fullLabel: `${MONTHS_FULL[a.mes - 1]} ${a.ano}`,
      partial: i === n - 1,
    }
    for (const s of series) {
      const v = s.values[i] ?? 0
      row[`${s.key}Raw`] = v
      row[`${s.key}Solid`] = i <= n - 2 ? v : null
      row[`${s.key}Dash`] = i >= n - 2 ? v : null
    }
    return row
  })

  return (
    <div>
      {/* Legenda manual (Recharts mostraria as chaves internas Solid/Dash). */}
      <div className="flex items-center flex-wrap gap-x-4 gap-y-1.5 mb-3">
        {series.map((s) => (
          <div key={s.key} className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 rounded-full" style={{ backgroundColor: s.color }} />
            <span className="text-xs text-text-muted">{s.label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <span
            className="w-3 border-t border-dashed"
            style={{ borderColor: TEXT_MUTED }}
          />
          <span className="text-xs text-text-muted">mês atual (parcial)</span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke={BORDER} strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fill: TEXT_MUTED, fontSize: 11 }}
            interval="preserveStartEnd"
            minTickGap={16}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: TEXT_MUTED, fontSize: 11 }}
            tickFormatter={formatBRLCompact}
            width={52}
          />
          <Tooltip
            content={(props) => (
              <EvoTooltip
                active={props.active}
                payload={props.payload as unknown as { payload: ChartRow }[]}
                series={series}
              />
            )}
            cursor={{ stroke: BORDER, strokeWidth: 1 }}
          />
          {series.map((s) => (
            <Fragment key={s.key}>
              <Line
                type="linear"
                dataKey={`${s.key}Solid`}
                stroke={s.color}
                strokeWidth={2}
                dot={{ r: 2, fill: s.color, strokeWidth: 0 }}
                activeDot={{ r: 4, strokeWidth: 0 }}
                connectNulls={false}
                isAnimationActive={false}
              />
              <Line
                type="linear"
                dataKey={`${s.key}Dash`}
                stroke={s.color}
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={makeLastDot(s.color, n - 1)}
                activeDot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
            </Fragment>
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
