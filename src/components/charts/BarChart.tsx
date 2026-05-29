import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { MesEvolucao } from '../../services/statistics'

const MONTHS_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

// Hex values required by Recharts — no CSS class support
const COLOR_RECEITA = '#3DBF7F'
const COLOR_DESPESA = '#E85D5D'

const formatBRL = (value: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)

const formatBRLFull = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

interface BarChartProps {
  data: MesEvolucao[]
  highlightMeses?: number[]
}

export default function BarChart({ data, highlightMeses }: BarChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-text-muted text-sm">
        Sem dados para exibir
      </div>
    )
  }

  const chartData = data.map((d) => ({
    name: MONTHS_SHORT[d.mes - 1],
    mes: d.mes,
    receitas: d.receitas,
    despesas: d.despesas,
    highlighted: highlightMeses?.includes(d.mes) ?? false,
  }))

  return (
    <div>
      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: COLOR_RECEITA }} />
          <span className="text-xs text-text-muted">Receitas</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: COLOR_DESPESA }} />
          <span className="text-xs text-text-muted">Despesas</span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <RechartsBarChart data={chartData} barCategoryGap="30%" barGap={2}>
          <CartesianGrid vertical={false} stroke="#3A3530" strokeDasharray="3 3" />
          <XAxis
            dataKey="name"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#888580', fontSize: 11 }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#888580', fontSize: 11 }}
            tickFormatter={formatBRL}
            width={52}
          />
          <Tooltip
            formatter={(value: number, name: string) => [
              formatBRLFull(value),
              name === 'receitas' ? 'Receitas' : 'Despesas',
            ]}
            contentStyle={{
              backgroundColor: '#2A2520',
              border: '1px solid #3A3530',
              borderRadius: '8px',
              color: '#F5F0E8',
              fontSize: '12px',
            }}
            itemStyle={{ color: '#F5F0E8' }}
            cursor={{ fill: '#3A3530', radius: 4 }}
          />
          <Bar dataKey="receitas" fill={COLOR_RECEITA} radius={[3, 3, 0, 0]} maxBarSize={20} />
          <Bar dataKey="despesas" fill={COLOR_DESPESA} radius={[3, 3, 0, 0]} maxBarSize={20} />
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  )
}
