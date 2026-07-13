import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import type { CategoriaStats } from '../../services/statistics'

// Hex values are from the brand guide tokens — required by Recharts (no CSS class support)
const CHART_COLORS = [
  '#EF9F27', // amber
  '#3DBF7F', // success
  '#E85D5D', // danger
  '#FAC775', // amber-light
  '#BA7517', // amber-dark
  '#888580', // text-muted
]

// Tailwind classes for legend dots — same order as CHART_COLORS
const DOT_CLASSES = [
  'bg-amber',
  'bg-success',
  'bg-danger',
  'bg-amber-light',
  'bg-amber-dark',
  'bg-text-muted',
]

const formatBRL = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

interface DonutChartProps {
  data: CategoriaStats[]
  // Versão "aprofundada" (Resumo/Seção 1): cada linha da legenda ganha o VALOR
  // além do %. Default false preserva o mini-donut do Dashboard (só %).
  showValues?: boolean
  // 'lg' = donut maior (Resumo). Default 'sm' = tamanho do Dashboard, intocado.
  size?: 'sm' | 'lg'
}

// Dimensões por tamanho. 'sm' reproduz exatamente o donut do Dashboard.
const DIMS = {
  sm: { height: 200, inner: 55, outer: 85 },
  lg: { height: 240, inner: 70, outer: 100 },
} as const

export default function DonutChart({ data, showValues = false, size = 'sm' }: DonutChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-text-muted text-sm">
        Sem categorias para exibir
      </div>
    )
  }

  const dims = DIMS[size]

  return (
    <div>
      <ResponsiveContainer width="100%" height={dims.height}>
        <PieChart>
          <Pie
            data={data}
            dataKey="total"
            nameKey="categoria"
            innerRadius={dims.inner}
            outerRadius={dims.outer}
            paddingAngle={2}
            strokeWidth={0}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: unknown) => {
              const v = value as number
              return [formatBRL(v), 'Total']
            }}
            contentStyle={{
              backgroundColor: '#2A2520',
              border: '1px solid #3A3530',
              borderRadius: '8px',
              color: '#F5F0E8',
              fontSize: '12px',
            }}
            itemStyle={{ color: '#F5F0E8' }}
            cursor={false}
          />
        </PieChart>
      </ResponsiveContainer>

      <div className="flex flex-col gap-2 mt-2">
        {data.map((item, i) => (
          <div key={item.categoria} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div
                className={`w-2.5 h-2.5 rounded-full shrink-0 ${DOT_CLASSES[i % DOT_CLASSES.length]}`}
              />
              <span className="text-xs text-text-muted truncate">{item.categoria}</span>
            </div>
            {showValues ? (
              <div className="flex items-center gap-3 shrink-0 tabular-nums">
                <span className="text-xs text-text-primary font-medium">
                  {formatBRL(item.total)}
                </span>
                <span className="text-xs text-text-muted w-14 text-right">
                  {Number(item.percentual).toFixed(1).replace('.', ',')}%
                </span>
              </div>
            ) : (
              <span className="text-xs text-text-primary font-medium shrink-0">
                {Number(item.percentual).toFixed(1).replace('.', ',')}%
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
