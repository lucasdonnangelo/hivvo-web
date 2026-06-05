import { useMemo, useState } from 'react'
import { useBreakpoint } from '../../hooks/useBreakpoint'
import { useMonthlyStats } from '../../hooks/useStatistics'
import { useTransactions } from '../../hooks/useTransactions'
import { useUpcomingInstallments } from '../../hooks/useInstallments'
import { useCards } from '../../hooks/useCards'
import type { Transaction } from '../../services/transactions'
import DonutChart from '../../components/charts/DonutChart'
import OnboardingBanner from '../../components/ui/OnboardingBanner'

// ─── helpers ────────────────────────────────────────────────────────────────

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

const formatBRL = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

const formatDate = (dateStr: string) => {
  const [, month, day] = dateStr.split('-')
  return `${day}/${month}`
}

const formatVariacao = (v: number | null | undefined): string | null => {
  if (v == null) return null
  const sign = v > 0 ? '+' : ''
  return `${sign}${v.toFixed(1).replace('.', ',')}%`
}

// ─── sub-components ─────────────────────────────────────────────────────────

function SkeletonDashboard({ isMobile }: { isMobile: boolean }) {
  if (isMobile) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <div className="h-8 bg-bg-surface rounded-md animate-pulse" />
        <div className="h-24 bg-bg-surface rounded-lg animate-pulse" />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-20 bg-bg-surface rounded-lg animate-pulse" />
          <div className="h-20 bg-bg-surface rounded-lg animate-pulse" />
        </div>
        <div className="h-28 bg-bg-surface rounded-lg animate-pulse" />
        <div className="h-72 bg-bg-surface rounded-lg animate-pulse" />
        <div className="h-52 bg-bg-surface rounded-lg animate-pulse" />
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="h-8 w-52 bg-bg-surface rounded-md animate-pulse" />
      <div className="grid grid-cols-3 gap-4">
        <div className="h-24 bg-bg-surface rounded-lg animate-pulse" />
        <div className="h-24 bg-bg-surface rounded-lg animate-pulse" />
        <div className="h-24 bg-bg-surface rounded-lg animate-pulse" />
      </div>
      <div className="grid grid-cols-[45%_1fr] gap-4">
        <div className="h-80 bg-bg-surface rounded-lg animate-pulse" />
        <div className="flex flex-col gap-4">
          <div className="h-36 bg-bg-surface rounded-lg animate-pulse" />
          <div className="flex-1 bg-bg-surface rounded-lg animate-pulse" />
        </div>
      </div>
    </div>
  )
}

interface MetricCardProps {
  label: string
  value: number
  color: 'neutral' | 'success' | 'danger'
  variacao?: number | null
  variacaoInverted?: boolean
}

function MetricCard({ label, value, color, variacao, variacaoInverted = false }: MetricCardProps) {
  const valueClass =
    color === 'success' ? 'text-success' :
    color === 'danger'  ? 'text-danger'  :
    'text-text-primary'

  const variacaoText = formatVariacao(variacao)
  const variacaoClass =
    variacao == null ? '' :
    variacaoInverted
      ? variacao > 0 ? 'text-danger' : 'text-success'
      : variacao > 0 ? 'text-success' : 'text-danger'

  return (
    <div className="bg-bg-surface rounded-lg p-4">
      <p className="text-xs text-text-muted mb-1">{label}</p>
      <p className={`text-xl font-medium ${valueClass}`}>{formatBRL(value)}</p>
      {variacaoText && (
        <p className={`text-xs mt-1 ${variacaoClass}`}>{variacaoText} vs mês ant.</p>
      )}
    </div>
  )
}

function TransactionItem({ tx }: { tx: Transaction }) {
  const isReceita = tx.tipo === 'receita'
  const valor = Math.abs(parseFloat(tx.valor))
  return (
    <div className="flex items-center justify-between py-3 border-b border-bg-border last:border-0">
      <div className="flex flex-col min-w-0">
        <span className="text-sm text-text-primary truncate">{tx.descricao}</span>
        <span className="text-xs text-text-muted">
          {tx.categoria} · {formatDate(tx.data)}
        </span>
      </div>
      <span
        className={`text-sm font-medium ml-4 shrink-0 ${
          isReceita ? 'text-success' : 'text-danger'
        }`}
      >
        {isReceita ? '+' : '-'}{formatBRL(valor)}
      </span>
    </div>
  )
}

function EmptyState({ mes, ano }: { mes: number; ano: number }) {
  const isMobile = useBreakpoint('md')
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-12 h-12 rounded-full bg-bg-surface flex items-center justify-center mb-4">
        <span className="text-amber text-lg">◇</span>
      </div>
      <p className="text-text-primary font-medium">Sem movimentações</p>
      <p className="text-text-muted text-sm mt-1">
        Nenhuma transação em {MONTHS[mes - 1]} {ano}
      </p>
      <p className="text-text-muted text-xs mt-4">
        {isMobile
          ? 'Toque no botão + abaixo para adicionar sua primeira transação.'
          : 'Clique no ícone + na barra lateral para adicionar sua primeira transação.'}
      </p>
    </div>
  )
}

interface CommitmentsEntry {
  mes: number
  ano: number
  total: number
}

function CommitmentsCard({
  data,
  isLoading,
}: {
  data: CommitmentsEntry[]
  isLoading: boolean
}) {
  const grandTotal = data.reduce((s, d) => s + d.total, 0)
  return (
    <div className="bg-bg-surface rounded-lg p-4">
      <h2 className="text-sm font-medium text-text-primary mb-3">Compromissos futuros</h2>
      {isLoading ? (
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-8 bg-bg-border rounded-md animate-pulse" />
          ))}
          <div className="border-t border-bg-border mt-1 pt-2">
            <div className="h-8 bg-bg-border rounded-md animate-pulse" />
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-col">
            {data.map(({ mes, ano, total }) => (
              <div
                key={`${mes}-${ano}`}
                className="flex items-center justify-between py-2 border-b border-bg-border last:border-0"
              >
                <span className="text-sm text-text-muted">
                  {MONTHS[mes - 1]} {ano}
                </span>
                <span className="text-sm font-medium text-amber">{formatBRL(total)}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between pt-3 mt-1">
            <span className="text-xs font-medium text-text-muted">Total 3 meses</span>
            <span className="text-base font-medium text-amber">{formatBRL(grandTotal)}</span>
          </div>
        </>
      )}
    </div>
  )
}

// ─── page ────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const isMobile = useBreakpoint('md')
  const now = new Date()
  const [mes, setMes] = useState(now.getMonth() + 1)
  const [ano, setAno] = useState(now.getFullYear())

  const isCurrentMonth = mes === now.getMonth() + 1 && ano === now.getFullYear()

  const prevMonth = () => {
    if (mes === 1) { setMes(12); setAno((a) => a - 1) }
    else setMes((m) => m - 1)
  }

  const nextMonth = () => {
    if (isCurrentMonth) return
    if (mes === 12) { setMes(1); setAno((a) => a + 1) }
    else setMes((m) => m + 1)
  }

  const { data: stats, isLoading: statsLoading, isError } = useMonthlyStats(mes, ano)
  const { data: transactions, isLoading: txLoading } = useTransactions(mes, ano)
  const { data: parcelas = [], isLoading: parcelasLoading } = useUpcomingInstallments()
  const { data: cards = [] } = useCards()

  const isLoading = statsLoading || txLoading

  const upcomingMonths = useMemo(() => {
    const today = new Date()
    const curMes = today.getMonth() + 1
    const curAno = today.getFullYear()
    return [0, 1, 2].map((offset) => {
      const totalMonth = curMes - 1 + offset
      return {
        mes: (totalMonth % 12) + 1,
        ano: curAno + Math.floor(totalMonth / 12),
      }
    })
  }, [])

  const upcomingData = useMemo(
    () =>
      upcomingMonths.map(({ mes: m, ano: a }) => ({
        mes: m,
        ano: a,
        total: parcelas
          .filter((p) => p.fatura_mes === m && p.fatura_ano === a)
          .reduce((sum, p) => sum + parseFloat(p.valor_parcela), 0),
      })),
    [parcelas, upcomingMonths],
  )

  const recentTransactions = useMemo(() => {
    if (!transactions) return []
    return [...transactions]
      .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
      .slice(0, 5)
  }, [transactions])

  const isEmpty =
    !isLoading && stats !== undefined && stats.receitas === 0 && stats.despesas === 0

  const showOnboarding =
    !isLoading && (transactions ?? []).length === 0 && cards.length === 0

  const monthNav = (
    <div className="flex items-center justify-between">
      <button
        onClick={prevMonth}
        className="w-8 h-8 flex items-center justify-center rounded-md text-text-muted hover:text-text-primary hover:bg-bg-surface transition-colors"
        aria-label="Mês anterior"
      >
        ‹
      </button>
      <span className="text-sm font-medium text-text-primary">
        {MONTHS[mes - 1]} {ano}
      </span>
      <button
        onClick={nextMonth}
        disabled={isCurrentMonth}
        className="w-8 h-8 flex items-center justify-center rounded-md text-text-muted hover:text-text-primary hover:bg-bg-surface transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        aria-label="Próximo mês"
      >
        ›
      </button>
    </div>
  )

  if (isLoading) return <SkeletonDashboard isMobile={isMobile} />

  if (isError || !stats) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center p-6">
        <p className="text-danger font-medium">Erro ao carregar dados</p>
        <p className="text-text-muted text-sm mt-1">Verifique sua conexão e tente novamente.</p>
      </div>
    )
  }

  const saldoColor: MetricCardProps['color'] =
    stats.saldo > 0 ? 'success' : stats.saldo < 0 ? 'danger' : 'neutral'

  // ── mobile ──────────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div className="flex flex-col gap-4 p-4">
        {monthNav}

        <MetricCard label="Saldo do Mês" value={stats.saldo} color={saldoColor} />

        <div className="grid grid-cols-2 gap-3">
          <MetricCard
            label="Receitas"
            value={stats.receitas}
            color="success"
            variacao={stats.variacao_receitas}
          />
          <MetricCard
            label="Despesas"
            value={stats.despesas}
            color="danger"
            variacao={stats.variacao_despesas}
            variacaoInverted
          />
        </div>

        <CommitmentsCard data={upcomingData} isLoading={parcelasLoading} />

        {showOnboarding && <OnboardingBanner />}

        {isEmpty ? (
          <EmptyState mes={mes} ano={ano} />
        ) : (
          <>
            <div className="bg-bg-surface rounded-lg p-4">
              <h2 className="text-sm font-medium text-text-primary mb-3">
                Gastos por categoria
              </h2>
              <DonutChart data={stats.categorias} />
            </div>

            <div className="bg-bg-surface rounded-lg p-4">
              <h2 className="text-sm font-medium text-text-primary mb-3">
                Últimas transações
              </h2>
              {recentTransactions.length === 0 ? (
                <p className="text-text-muted text-sm py-4 text-center">
                  Nenhuma transação encontrada.
                </p>
              ) : (
                recentTransactions.map((tx) => <TransactionItem key={tx.id} tx={tx} />)
              )}
            </div>
          </>
        )}
      </div>
    )
  }

  // ── desktop ─────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4 p-6">
      {monthNav}

      <div className="grid grid-cols-3 gap-4">
        <MetricCard label="Saldo do Mês" value={stats.saldo} color={saldoColor} />
        <MetricCard
          label="Receitas"
          value={stats.receitas}
          color="success"
          variacao={stats.variacao_receitas}
        />
        <MetricCard
          label="Despesas"
          value={stats.despesas}
          color="danger"
          variacao={stats.variacao_despesas}
          variacaoInverted
        />
      </div>

      {showOnboarding && <OnboardingBanner />}

      {isEmpty ? (
        <EmptyState mes={mes} ano={ano} />
      ) : (
        <div className="grid grid-cols-[45%_1fr] gap-4">
          <div className="bg-bg-surface rounded-lg p-6">
            <h2 className="text-sm font-medium text-text-primary mb-4">
              Gastos por categoria
            </h2>
            <DonutChart data={stats.categorias} />
          </div>

          <div className="flex flex-col gap-4">
            <CommitmentsCard data={upcomingData} isLoading={parcelasLoading} />
            <div className="bg-bg-surface rounded-lg p-6 flex-1">
              <h2 className="text-sm font-medium text-text-primary mb-4">
                Últimas transações
              </h2>
              {recentTransactions.length === 0 ? (
                <p className="text-text-muted text-sm">Nenhuma transação encontrada.</p>
              ) : (
                recentTransactions.map((tx) => <TransactionItem key={tx.id} tx={tx} />)
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
