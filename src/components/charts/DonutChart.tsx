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
}

export default function DonutChart({ data }: DonutChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-text-muted text-sm">
        Sem categorias para exibir
      </div>
    )
  }

  return (
    <div>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data}
            dataKey="total"
            nameKey="categoria"
            innerRadius={55}
            outerRadius={85}
            paddingAngle={2}
            strokeWidth={0}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number) => [formatBRL(value), 'Total']}
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
            <span className="text-xs text-text-primary font-medium shrink-0">
              {Number(item.percentual).toFixed(1).replace('.', ',')}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
