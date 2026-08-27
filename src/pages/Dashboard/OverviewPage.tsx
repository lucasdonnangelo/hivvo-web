import { useMemo, useState } from 'react'
import { useBreakpoint } from '../../hooks/useBreakpoint'
import { useCoverage, useMonthlyStats, useProjection } from '../../hooks/useStatistics'
import { useTransactions } from '../../hooks/useTransactions'
import { useCards } from '../../hooks/useCards'
import type { Transaction } from '../../services/transactions'
import { presentTipo } from '../../lib/tipoTransacao'
import {
  deveMostrarOnboarding,
  temCartaoAtivo,
  temHistorico,
} from '../../lib/deveMostrarOnboarding'
import type { ProjectionMonth } from '../../services/statistics'
import { derivarLinhaDoMes } from '../../lib/linhaDoMes'
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

// Espelha o layout real: TRÊS caixas de métrica (não quatro) e sem a caixa do
// donut, que saiu da Visão geral. Esqueleto que não espelha o grid é um salto
// visual no carregamento — e some da revisão, porque só aparece por 200ms.
function SkeletonDashboard({ isMobile }: { isMobile: boolean }) {
  if (isMobile) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <div className="h-10 bg-bg-surface rounded-md animate-pulse" />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-24 bg-bg-surface rounded-lg animate-pulse" />
          <div className="h-24 bg-bg-surface rounded-lg animate-pulse" />
          <div className="col-span-2 h-24 bg-bg-surface rounded-lg animate-pulse" />
        </div>
        <div className="h-28 bg-bg-surface rounded-lg animate-pulse" />
        <div className="h-52 bg-bg-surface rounded-lg animate-pulse" />
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="h-10 w-52 bg-bg-surface rounded-md animate-pulse" />
      <div className="grid grid-cols-3 gap-4">
        <div className="h-24 bg-bg-surface rounded-lg animate-pulse" />
        <div className="h-24 bg-bg-surface rounded-lg animate-pulse" />
        <div className="h-24 bg-bg-surface rounded-lg animate-pulse" />
      </div>
      <div className="h-80 bg-bg-surface rounded-lg animate-pulse" />
    </div>
  )
}

interface MetricCardProps {
  label: string
  value: number
  color: 'neutral' | 'success' | 'danger'
  variacao?: number | null
  // Leve destaque visual (número-resposta): usado no card SALDO do Bloco 1.
  emphasis?: boolean
  /**
   * Linha de apoio que DECOMPÕE o valor do card (hoje: "saiu X · ainda sai Y"
   * sob Saídas do mês). Não é legenda nem explicação — são números que somam o
   * valor de cima, e é por isso que ela cabe aqui e não num tooltip.
   *
   * Mobile (390px, card de meia largura ≈ 171px úteis): `text-[10px]` com
   * `leading-snug` e quebra NATURAL em duas linhas — o separador `·` tem
   * espaços em volta, então o ponto de quebra cai entre os dois pares e nunca
   * no meio de um valor. Sem `truncate`: cortar dinheiro com reticências é
   * pior que ocupar uma segunda linha. `tabular-nums` mantém o alinhamento
   * quando os dois valores têm dígitos diferentes.
   */
  sublinha?: string
}

function MetricCard({
  label,
  value,
  color,
  variacao,
  emphasis = false,
  sublinha,
}: MetricCardProps) {
  const valueClass =
    color === 'success' ? 'text-success' :
    color === 'danger'  ? 'text-danger'  :
    'text-text-primary'

  const variacaoText = formatVariacao(variacao)
  const variacaoClass =
    variacao == null ? '' :
    variacao > 0 ? 'text-success' : 'text-danger'

  return (
    <div className={`bg-bg-surface rounded-lg p-4 ${emphasis ? 'ring-1 ring-bg-border' : ''}`}>
      <p className="text-xs text-text-muted mb-1">{label}</p>
      <p className={`${emphasis ? 'text-2xl font-semibold' : 'text-xl font-medium'} ${valueClass}`}>
        {formatBRL(value)}
      </p>
      {variacaoText && (
        <p className={`text-xs mt-1 ${variacaoClass}`}>{variacaoText} vs mês ant.</p>
      )}
      {sublinha && (
        <p
          className="text-[10px] leading-snug mt-1 text-text-muted tabular-nums"
          data-testid="metric-sublinha"
        >
          {sublinha}
        </p>
      )}
    </div>
  )
}

function TransactionItem({ tx }: { tx: Transaction }) {
  const pres = presentTipo(tx.tipo)
  const valor = Math.abs(parseFloat(tx.valor))
  return (
    <div className="flex items-center justify-between py-3 border-b border-bg-border last:border-0">
      <div className="flex flex-col min-w-0">
        <span className="text-sm text-text-primary truncate">{tx.descricao}</span>
        <span className="text-xs text-text-muted flex items-center gap-1.5">
          <span className="truncate">{tx.categoria} · {formatDate(tx.data)}</span>
          {pres.badge && (
            <span className={`shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${pres.badgeClass}`}>
              {pres.badge}
            </span>
          )}
        </span>
      </div>
      <span className={`text-sm font-medium ml-4 shrink-0 ${pres.amountClass}`}>
        {pres.sign}{formatBRL(valor)}
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
          <p className="text-sm font-medium text-danger">{formatBRL(m.despesas)}</p>
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
        <span className="text-danger">−{formatBRL(m.despesas)} a pagar</span>
      </div>
    </div>
  )
}

// Teto inicial do horizonte: 6 meses = card destacado series[0] + até 5 linhas.
const PROJECTION_CAP = 6

// Mês "com conteúdo" = alguma receita, despesa ou a-pagar não-zero na linha.
// Uma linha só de zeros não informa nada — não conta como conteúdo.
const hasContent = (m: ProjectionMonth) =>
  m.receitas > 0 || m.despesas > 0 || m.a_pagar > 0

function ProjectionBlock({
  series,
  isLoading,
  isError,
}: {
  series: ProjectionMonth[] | undefined
  isLoading: boolean
  isError: boolean
}) {
  // UI-state local (não persiste): "ver mais" expande o horizonte, "ver menos" recolhe.
  const [expanded, setExpanded] = useState(false)

  // Índice do ÚLTIMO mês com conteúdo (-1 se a série é toda zerada). Define o fim
  // do horizonte: a cauda de zeros depois dele não é exibida; zeros no meio, sim.
  const lastContentIdx = useMemo(() => {
    if (!series) return -1
    for (let i = series.length - 1; i >= 0; i--) {
      if (hasContent(series[i])) return i
    }
    return -1
  }, [series])

  const title = <h2 className="text-lg font-medium text-text-primary">Sua projeção</h2>

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <div>
          {title}
          <p className="text-sm text-text-muted">Próximos 12 meses</p>
        </div>
        <div className="h-32 bg-bg-surface rounded-lg animate-pulse" />
        <div className="h-64 bg-bg-surface rounded-lg animate-pulse" />
      </div>
    )
  }

  // Erro de fetch (distinto de conta zerada): mensagem neutra, sem lista de zeros.
  if (isError || !series || series.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <div>{title}</div>
        <div className="bg-bg-surface rounded-lg p-4">
          <p className="text-text-muted text-sm">Sem projeção disponível.</p>
        </div>
      </div>
    )
  }

  // Caso 1 — nenhum mês com conteúdo (12 zerados): empty state honesto, sem a
  // parede de "R$0,00" e sem o card destacado.
  if (lastContentIdx === -1) {
    return (
      <div className="flex flex-col gap-3">
        <div>{title}</div>
        <div className="bg-bg-surface rounded-lg p-5">
          <p className="text-text-muted text-sm">
            Registre parcelas ou recorrências e sua projeção dos próximos meses aparecerá aqui.
          </p>
        </div>
      </div>
    )
  }

  // Caso 3 — horizonte dinâmico. count = meses exibidos (inclui o destacado).
  // Recolhido: até o teto (ou até o último com conteúdo, se antes). Expandido:
  // até o último com conteúdo. A fatia é contígua, então zeros no meio ficam.
  const contentCount = lastContentIdx + 1
  const canExpand = contentCount > PROJECTION_CAP
  const count = expanded && canExpand ? contentCount : Math.min(PROJECTION_CAP, contentCount)
  const rows = series.slice(1, count)

  return (
    <div className="flex flex-col gap-3">
      <div>
        {title}
        <p className="text-sm text-text-muted">Próximos meses</p>
      </div>

      <ProjectionHighlight m={series[0]} />

      {rows.length > 0 && (
        <div className="bg-bg-surface rounded-lg p-4">
          {rows.map((m) => (
            <ProjectionRow key={`${m.ano}-${m.mes}`} m={m} />
          ))}
        </div>
      )}

      {canExpand && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="self-start text-sm font-medium text-amber hover:opacity-80 transition-opacity rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-amber"
        >
          {expanded ? 'Ver menos' : 'Ver mais'}
        </button>
      )}
    </div>
  )
}

// ─── page ────────────────────────────────────────────────────────────────────

interface OverviewPageProps {
  // A Análise é a outra ABA (estado local do DashboardPage), não uma rota — o
  // passo 3 do onboarding precisa de um callback para chegar lá.
  onVerAnalise: () => void
}

export default function OverviewPage({ onVerAnalise }: OverviewPageProps) {
  const isMobile = useBreakpoint('md')

  // Bloco 1 "Seu mês" — âncora no mês corrente, FIXO (sem navegação de mês). Todos
  // os dados do bloco vêm de UMA chamada /monthly deste mês.
  const now = new Date()
  const mes = now.getMonth() + 1
  const ano = now.getFullYear()

  const { data: stats, isLoading: statsLoading, isError } = useMonthlyStats(mes, ano)
  const { data: transactions, isLoading: txLoading } = useTransactions(mes, ano)
  const { data: cards = [] } = useCards()
  // Histórico INTEIRO, sem parâmetro de mês — o único sinal honesto de "esta
  // conta já tem dado", e o mesmo que governa o florescimento da Análise.
  const { data: coverage } = useCoverage()

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

  // A regra vive em lib/deveMostrarOnboarding (pura, com teste): foi ELA o
  // defeito que abriu este batch — um `&&` onde cabia `||` derrubava o guia no
  // passo 1 —, e é a metade que o harness não alcança. Os dois predicados saem
  // de lá também, para o ✓ de cada passo não divergir da regra que decide se o
  // banner aparece.
  const showOnboarding = deveMostrarOnboarding(cards, coverage, isLoading)

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

  // Bloco 1 — TRÊS campos que formam UMA cadeia aritmética visível:
  //
  //     Receitas − Saídas do mês = Saldo no fim do mês
  //     11.000,00 −    1.402,50  =         9.597,50
  //                  saiu 1.040,00 · ainda sai 362,50
  //
  // A derivação mora em lib/linhaDoMes (função pura, com teste): o hivvo-web não
  // tem teste de componente nem runner de mutação, então regra dentro do JSX é
  // regra sem portão — e foi essa topologia que deixou o defeito passar.
  //
  // RÓTULOS, e não são estilo:
  //  - "Saídas do mês", NUNCA "Despesas": a palavra Despesas já significa
  //    CONSUMO (9.590,00) na Análise e no donut. Mesma palavra para dois valores
  //    é o defeito que criou o bug do limite do cartão (usado × comprometido).
  //  - "Saldo no fim do mês", NUNCA "Saldo atual": o app não tem entidade Conta;
  //    este número é resultado do mês. "Atual" prometeria estoque e entregaria
  //    fluxo. UM saldo só — "Saldo até agora" é o número que nasce quando Conta
  //    existir (PLANO_SALDO_CONTAS), e meia versão dele agora é retrabalho.
  //  - "ainda sai", NUNCA "a pagar": `a_vir` é eixo TEMPO; `a_pagar` é eixo
  //    DÍVIDA e não fecha a soma (ver lib/linhaDoMes). "A pagar" continua no
  //    Bloco 2, nos Cartões e na Análise — sai só da linha de topo.
  const linha = derivarLinhaDoMes(stats)

  const saldoColor: MetricCardProps['color'] =
    linha.saldo > 0 ? 'success' : linha.saldo < 0 ? 'danger' : 'neutral'

  const receitasCard = (
    <MetricCard
      label="Receitas"
      value={linha.receitas}
      color="success"
      variacao={stats.variacao_receitas}
    />
  )
  const saidasCard = (
    <MetricCard
      label="Saídas do mês"
      value={linha.saidas}
      color="danger"
      // Sem decomposição (contrato antigo, sem realizado/a_vir) a sublinha some:
      // o fallback põe tudo em `saiu`, o que seria falso num mês corrente.
      sublinha={
        linha.temDecomposicao
          ? `saiu ${formatBRL(linha.saiu)} · ainda sai ${formatBRL(linha.aindaSai)}`
          : undefined
      }
    />
  )
  const saldoCard = (
    <MetricCard
      label="Saldo no fim do mês"
      value={linha.saldo}
      color={saldoColor}
      emphasis
    />
  )

  // O donut "Gastos por categoria" SAIU daqui (25/08/2026). Era idêntico ao da
  // Análise, que é mais completo (`showValues`, `size="lg"`), e as duas abas são
  // NÍVEIS DE ZOOM: a Visão geral responde "como estou de caixa", a Análise
  // responde "no que gastei". Com ele fora e "Despesas" virando "Saídas do mês",
  // a lente CONSUMO deixa de existir na Visão geral inteira — isso é
  // DELIBERADO, não sobra de refatoração; ver PLANO_DASHBOARD_DOIS_BLOCOS.

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

        {/* Mobile: a cadeia lida de cima para baixo. Receitas e Saídas dividem a
            linha (os dois operandos, lado a lado); o Saldo ocupa a largura
            inteira embaixo, como o RESULTADO. Três colunas a 390px dariam ~110px
            por card — não cabe "R$ 11.000,00" em text-xl, e o público-alvo tem
            valores de 6 dígitos. */}
        <div className="grid grid-cols-2 gap-3">
          {receitasCard}
          {saidasCard}
          <div className="col-span-2">{saldoCard}</div>
        </div>

        {showOnboarding && (
          <OnboardingBanner
            temCartao={temCartaoAtivo(cards)}
            temHistorico={temHistorico(coverage)}
            isMobile={isMobile}
            onVerAnalise={onVerAnalise}
          />
        )}

        {isEmpty ? <EmptyState mes={mes} ano={ano} /> : transactionsSection}

        {projectionSection}
      </div>
    )
  }

  // ── desktop ─────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4 p-6">
      {header}

      {/* Desktop: três colunas iguais, na ordem da cadeia (Receitas − Saídas =
          Saldo). O Saldo mantém o `emphasis` — é o número-resposta. */}
      <div className="grid grid-cols-3 gap-4">
        {receitasCard}
        {saidasCard}
        {saldoCard}
      </div>

      {showOnboarding && (
        <OnboardingBanner
          temCartao={temCartaoAtivo(cards)}
          temHistorico={temHistorico(coverage)}
          isMobile={isMobile}
          onVerAnalise={onVerAnalise}
        />
      )}

      {isEmpty ? (
        <EmptyState mes={mes} ano={ano} />
      ) : (
        <div className="grid grid-cols-1 gap-4">
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
