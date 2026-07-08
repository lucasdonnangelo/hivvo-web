import { useMemo } from 'react'
import { useBreakpoint } from '../../hooks/useBreakpoint'
import { useMonthlyStats, useProjection } from '../../hooks/useStatistics'
import { useTransactions } from '../../hooks/useTransactions'
import { useCards } from '../../hooks/useCards'
import type { Transaction } from '../../services/transactions'
import type { ProjectionMonth } from '../../services/statistics'
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

// Cor do saldo por sinal — coerente com o card SALDO do Bloco 1 (zero = neutro).
const saldoColorClass = (v: number) =>
  v > 0 ? 'text-success' : v < 0 ? 'text-danger' : 'text-text-primary'

// ─── sub-components ─────────────────────────────────────────────────────────

function SkeletonDashboard({ isMobile }: { isMobile: boolean }) {
  if (isMobile) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <div className="h-10 bg-bg-surface rounded-md animate-pulse" />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-24 bg-bg-surface rounded-lg animate-pulse" />
          <div className="h-24 bg-bg-surface rounded-lg animate-pulse" />
          <div className="h-24 bg-bg-surface rounded-lg animate-pulse" />
          <div className="h-24 bg-bg-surface rounded-lg animate-pulse" />
        </div>
        <div className="h-28 bg-bg-surface rounded-lg animate-pulse" />
        <div className="h-72 bg-bg-surface rounded-lg animate-pulse" />
        <div className="h-52 bg-bg-surface rounded-lg animate-pulse" />
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="h-10 w-52 bg-bg-surface rounded-md animate-pulse" />
      <div className="grid grid-cols-4 gap-4">
        <div className="h-24 bg-bg-surface rounded-lg animate-pulse" />
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
  // Leve destaque visual (número-resposta): usado no card SALDO do Bloco 1.
  emphasis?: boolean
  // Decomposição do mês corrente (realizado / a-vir). No Bloco 1 vive no card
  // A PAGAR (fluxo): só passada quando há algo a vir; caso contrário o card
  // mostra apenas o principal (o valor cheio de fluxo do mês).
  decomposition?: { realizado: number; aVir: number }
}

function MetricCard({ label, value, color, variacao, variacaoInverted = false, emphasis = false, decomposition }: MetricCardProps) {
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
    <div className={`bg-bg-surface rounded-lg p-4 ${emphasis ? 'ring-1 ring-bg-border' : ''}`}>
      <p className="text-xs text-text-muted mb-1">{label}</p>
      <p className={`${emphasis ? 'text-2xl font-semibold' : 'text-xl font-medium'} ${valueClass}`}>
        {formatBRL(value)}
      </p>
      {variacaoText && (
        <p className={`text-xs mt-1 ${variacaoClass}`}>{variacaoText} vs mês ant.</p>
      )}
      {decomposition && (
        <div className="mt-2 flex flex-col gap-0.5">
          <p className="text-xs text-text-muted">
            Já realizado: <span className="text-text-primary">{formatBRL(decomposition.realizado)}</span>
          </p>
          <p className="text-xs text-text-muted">
            A vir este mês: <span className="text-text-primary">{formatBRL(decomposition.aVir)}</span>
          </p>
        </div>
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

// ─── Bloco 2 "Sua projeção" ──────────────────────────────────────────────────

// Mês destacado (series[0] = mês default por construção): o saldo previsto é o
// número-herói (coerente com o SALDO do Bloco 1); receitas/a-pagar como apoio.
function ProjectionHighlight({ m }: { m: ProjectionMonth }) {
  return (
    <div className="bg-bg-surface rounded-lg p-5 ring-1 ring-amber">
      <p className="text-xs text-amber font-medium mb-2">
        Em destaque · {MONTHS[m.mes - 1]} {m.ano}
      </p>
      <p className="text-xs text-text-muted">Saldo previsto</p>
      <p className={`text-2xl font-semibold ${saldoColorClass(m.saldo)}`}>{formatBRL(m.saldo)}</p>
      <div className="grid grid-cols-2 gap-4 mt-3">
        <div>
          <p className="text-xs text-text-muted mb-0.5">Receitas</p>
          <p className="text-sm font-medium text-success">{formatBRL(m.receitas)}</p>
        </div>
        <div>
          <p className="text-xs text-text-muted mb-0.5">A pagar</p>
          <p className="text-sm font-medium text-text-primary">{formatBRL(m.a_pagar)}</p>
        </div>
      </div>
    </div>
  )
}

// Linha compacta de um mês da projeção. Dois níveis (mobile-safe): mês + saldo
// (o número-resposta) em cima; receitas/a-pagar de apoio embaixo. Meses zerados
// aparecem — a série é contínua.
function ProjectionRow({ m }: { m: ProjectionMonth }) {
  return (
    <div className="py-2.5 border-b border-bg-border last:border-0">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-text-primary">
          {MONTHS[m.mes - 1]} <span className="text-text-muted">{m.ano}</span>
        </span>
        <span className={`text-sm font-medium ${saldoColorClass(m.saldo)}`}>
          {formatBRL(m.saldo)}
        </span>
      </div>
      <div className="flex items-center gap-3 mt-0.5 text-xs text-text-muted">
        <span className="text-success">+{formatBRL(m.receitas)}</span>
        <span>−{formatBRL(m.a_pagar)} a pagar</span>
      </div>
    </div>
  )
}

function ProjectionBlock({
  series,
  isLoading,
  isError,
}: {
  series: ProjectionMonth[] | undefined
  isLoading: boolean
  isError: boolean
}) {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="text-lg font-medium text-text-primary">Sua projeção</h2>
        <p className="text-sm text-text-muted">Próximos 12 meses</p>
      </div>

      {isLoading ? (
        <>
          <div className="h-32 bg-bg-surface rounded-lg animate-pulse" />
          <div className="h-64 bg-bg-surface rounded-lg animate-pulse" />
        </>
      ) : isError || !series || series.length === 0 ? (
        <div className="bg-bg-surface rounded-lg p-4">
          <p className="text-text-muted text-sm">Sem projeção disponível.</p>
        </div>
      ) : (
        <>
          <ProjectionHighlight m={series[0]} />
          {series.length > 1 && (
            <div className="bg-bg-surface rounded-lg p-4">
              {series.slice(1).map((m) => (
                <ProjectionRow key={`${m.ano}-${m.mes}`} m={m} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── page ────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const isMobile = useBreakpoint('md')

  // Bloco 1 "Seu mês" — âncora no mês corrente, FIXO (sem navegação de mês). Todos
  // os dados do bloco vêm de UMA chamada /monthly deste mês.
  const now = new Date()
  const mes = now.getMonth() + 1
  const ano = now.getFullYear()

  const { data: stats, isLoading: statsLoading, isError } = useMonthlyStats(mes, ano)
  const { data: transactions, isLoading: txLoading } = useTransactions(mes, ano)
  const { data: cards = [] } = useCards()

  // Bloco 2 "Sua projeção" — 12 meses de fluxo, começando no mês default (série[0]).
  // Query independente do /monthly: não trava a página nem o Bloco 1.
  const {
    data: projection,
    isLoading: projectionLoading,
    isError: projectionError,
  } = useProjection(12)

  const isLoading = statsLoading || txLoading

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

  const header = (
    <div>
      <h1 className="text-lg font-medium text-text-primary">Seu mês</h1>
      <p className="text-sm text-text-muted">{MONTHS[mes - 1]} {ano}</p>
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

  // Bloco 1 — os quatro campos, todos do /monthly do mês corrente:
  //  RECEITAS = receitas (topo).
  //  DESPESAS = consumo.despesas (lente CONSUMO — o que gastou/comprou no mês).
  //  A PAGAR  = despesas (topo/fluxo — o que vence e sai da conta no mês).
  //  SALDO    = saldo (topo; já é receitas − a pagar).
  // `consumo` é opcional no contrato (3b pode não estar no ar); em produção existe.
  // Degrada sem crash caindo no fluxo, e o donut cai para lista vazia.
  const despesasConsumo = stats.consumo?.despesas ?? stats.despesas
  const donutCategorias = stats.categorias_consumo ?? []

  const saldoColor: MetricCardProps['color'] =
    stats.saldo > 0 ? 'success' : stats.saldo < 0 ? 'danger' : 'neutral'

  // A PAGAR carrega a decomposição realizado/a-vir (§1.3.1), migrada do card Saldo:
  // "já saiu X, ainda sai Y este mês". Só quando há algo a vir de despesa — colapsa
  // no fim do mês (tudo já venceu) e some naturalmente em mês não-corrente.
  const aPagarDecomposition =
    stats.a_vir.despesas > 0
      ? { realizado: stats.realizado.despesas, aVir: stats.a_vir.despesas }
      : undefined

  const receitasCard = (
    <MetricCard
      label="Receitas"
      value={stats.receitas}
      color="success"
      variacao={stats.variacao_receitas}
    />
  )
  const despesasCard = (
    <MetricCard label="Despesas" value={despesasConsumo} color="danger" />
  )
  const aPagarCard = (
    <MetricCard
      label="A pagar"
      value={stats.despesas}
      color="neutral"
      variacao={stats.variacao_despesas}
      variacaoInverted
      decomposition={aPagarDecomposition}
    />
  )
  const saldoCard = (
    <MetricCard label="Saldo" value={stats.saldo} color={saldoColor} emphasis />
  )

  const donutSection = (
    <div className="bg-bg-surface rounded-lg p-4">
      <h2 className="text-sm font-medium text-text-primary mb-3">
        Gastos por categoria · {MONTHS[mes - 1]}
      </h2>
      <DonutChart data={donutCategorias} />
    </div>
  )

  const transactionsSection = (
    <div className="bg-bg-surface rounded-lg p-4">
      <h2 className="text-sm font-medium text-text-primary mb-3">Últimas transações</h2>
      {recentTransactions.length === 0 ? (
        <p className="text-text-muted text-sm py-4 text-center">
          Nenhuma transação encontrada.
        </p>
      ) : (
        recentTransactions.map((tx) => <TransactionItem key={tx.id} tx={tx} />)
      )}
    </div>
  )

  const projectionSection = (
    <ProjectionBlock
      series={projection?.series}
      isLoading={projectionLoading}
      isError={projectionError}
    />
  )

  // ── mobile ──────────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div className="flex flex-col gap-4 p-4">
        {header}

        <div className="grid grid-cols-2 gap-3">
          {receitasCard}
          {despesasCard}
          {aPagarCard}
          {saldoCard}
        </div>

        {showOnboarding && <OnboardingBanner />}

        {isEmpty ? (
          <EmptyState mes={mes} ano={ano} />
        ) : (
          <>
            {donutSection}
            {transactionsSection}
          </>
        )}

        {projectionSection}
      </div>
    )
  }

  // ── desktop ─────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4 p-6">
      {header}

      <div className="grid grid-cols-4 gap-4">
        {receitasCard}
        {despesasCard}
        {aPagarCard}
        {saldoCard}
      </div>

      {showOnboarding && <OnboardingBanner />}

      {isEmpty ? (
        <EmptyState mes={mes} ano={ano} />
      ) : (
        <div className="grid grid-cols-[45%_1fr] gap-4">
          <div className="bg-bg-surface rounded-lg p-6">
            <h2 className="text-sm font-medium text-text-primary mb-4">
              Gastos por categoria · {MONTHS[mes - 1]}
            </h2>
            <DonutChart data={donutCategorias} />
          </div>

          <div className="bg-bg-surface rounded-lg p-6">
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
      )}

      {projectionSection}
    </div>
  )
}
