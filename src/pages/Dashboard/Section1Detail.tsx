import { useMonthlyStats, useHighlights, useSpendingByCard } from '../../hooks/useStatistics'
import DonutChart from '../../components/charts/DonutChart'
import type { GastoCartaoItem } from '../../services/statistics'

// ─── Seção 1 "Este mês em detalhe" ────────────────────────────────────────────
//
// A seção que serve o usuário novo (valor no dia 1) e aprofunda o que o Dashboard
// só resume. BASE = CONSUMO → BATE com o donut do Dashboard: lê a MESMA
// `categorias_consumo` do MESMO /monthly (mesma queryKey → mesmo cache, sem drift).
// Compõe 3 fontes: gasto por categoria + receitas vs despesas (/monthly) e
// destaques (/highlights). É a única seção sempre presente, então trata o próprio
// vazio (não depende do coverage).

// ─── helpers ────────────────────────────────────────────────────────────────

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

const formatBRL = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

// "YYYY-MM-DD" → "DD/MM" (mesmo formato do Dashboard).
const formatDate = (dateStr: string) => {
  const [, month, day] = dateStr.split('-')
  return `${day}/${month}`
}

const resultadoColor = (v: number) =>
  v > 0 ? 'text-success' : v < 0 ? 'text-danger' : 'text-text-primary'

// Rótulos de movimentações — decomposição ADITIVA (total = lançadas + recorrentes),
// com pluralização. O "+" deixa explícito que é composição, não subtração.
const plural = (n: number, singular: string, plural: string) =>
  `${n} ${n === 1 ? singular : plural}`

// ─── sub-components ─────────────────────────────────────────────────────────

// Título do grupo (padrão do header "Seu mês" do Dashboard): título + mês.
function SectionHeader({ mes, ano }: { mes: number; ano: number }) {
  return (
    <div>
      <h2 className="text-lg font-medium text-text-primary">Este mês em detalhe</h2>
      <p className="text-sm text-text-muted">{MONTHS[mes - 1]} {ano}</p>
    </div>
  )
}

function Section1Skeleton({ isMobile }: { isMobile: boolean }) {
  if (isMobile) {
    return (
      <div className="flex flex-col gap-4">
        <div className="h-28 bg-bg-surface rounded-lg animate-pulse" />
        <div className="h-80 bg-bg-surface rounded-lg animate-pulse" />
        <div className="h-40 bg-bg-surface rounded-lg animate-pulse" />
        <div className="h-56 bg-bg-surface rounded-lg animate-pulse" />
      </div>
    )
  }
  return (
    <div className="grid grid-cols-[45%_1fr] gap-4">
      <div className="flex flex-col gap-4">
        <div className="h-96 bg-bg-surface rounded-lg animate-pulse" />
        <div className="h-40 bg-bg-surface rounded-lg animate-pulse" />
      </div>
      <div className="flex flex-col gap-4">
        <div className="h-28 bg-bg-surface rounded-lg animate-pulse" />
        <div className="flex-1 bg-bg-surface rounded-lg animate-pulse" />
      </div>
    </div>
  )
}

// Uma linha do "Consumo por cartão": nome + valor (R$) na 1ª linha, barra
// proporcional na 2ª. `pct` = largura (a maior barra = 100%). `muted` pinta o
// preenchimento em neutro — reservado à linha "Sem cartão" (não é um cartão real).
function SpendingBarRow({
  nome,
  valor,
  pct,
  muted = false,
}: {
  nome: string
  valor: number
  pct: number
  muted?: boolean
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-text-primary truncate min-w-0" title={nome}>
          {nome}
        </span>
        <span
          className="text-sm font-medium text-text-primary tabular-nums shrink-0"
          title={formatBRL(valor)}
        >
          {formatBRL(valor)}
        </span>
      </div>
      <div className="mt-1.5 h-2 rounded-full bg-bg overflow-hidden">
        <div
          className={`h-full rounded-full ${muted ? 'bg-text-muted' : 'bg-amber'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

// ─── section ─────────────────────────────────────────────────────────────────

export default function Section1Detail({ isMobile }: { isMobile: boolean }) {
  const now = new Date()
  const mes = now.getMonth() + 1
  const ano = now.getFullYear()

  const { data: stats, isLoading: statsLoading, isError: statsError } = useMonthlyStats(mes, ano)
  const { data: highlights, isLoading: hlLoading, isError: hlError } = useHighlights(mes, ano)
  const { data: spending, isLoading: spendingLoading, isError: spendingError } = useSpendingByCard(mes, ano)

  const pad = isMobile ? 'p-4' : 'p-6'

  // Uma cohesão só: a seção aparece inteira quando as fontes prontas (skeleton
  // único). O consumo-por-cartão entra no gate — carrega junto com o resto.
  if (statsLoading || hlLoading || spendingLoading) {
    return (
      <section className="flex flex-col gap-4">
        <SectionHeader mes={mes} ano={ano} />
        <Section1Skeleton isMobile={isMobile} />
      </section>
    )
  }

  // /monthly é a fonte crítica (categorias + composição). Se falhou, não há o que
  // aprofundar — mensagem neutra (highlights sozinho não sustenta a seção).
  if (statsError || !stats) {
    return (
      <section className="flex flex-col gap-4">
        <SectionHeader mes={mes} ano={ano} />
        <div className={`bg-bg-surface rounded-lg ${pad}`}>
          <p className="text-text-muted text-sm">
            Não foi possível carregar o detalhamento do mês. Tente novamente.
          </p>
        </div>
      </section>
    )
  }

  // Base CONSUMO (bate com o Dashboard); degrada para o fluxo se 3b não estiver no ar.
  const receitas = stats.consumo?.receitas ?? stats.receitas
  const despesas = stats.consumo?.despesas ?? stats.despesas
  const resultado = stats.consumo?.saldo ?? receitas - despesas
  const cats = stats.categorias_consumo ?? []

  // Mês vazio: highlights manda (num=0); sem highlights, cai no /monthly zerado.
  const monthlyEmpty = receitas === 0 && despesas === 0
  const isEmpty = highlights ? highlights.num_transacoes_total === 0 : monthlyEmpty

  if (isEmpty) {
    return (
      <section className="flex flex-col gap-4">
        <SectionHeader mes={mes} ano={ano} />
        <div className={`bg-bg-surface rounded-lg ${pad}`}>
          <div className="flex flex-col items-center text-center py-8">
            <div className="w-12 h-12 rounded-full bg-bg flex items-center justify-center mb-4">
              <span className="text-amber text-lg">◇</span>
            </div>
            <p className="text-text-primary font-medium">Nenhuma movimentação neste mês ainda</p>
            <p className="text-text-muted text-sm mt-1 max-w-xs">
              Adicione uma transação e o detalhamento do mês aparecerá aqui.
            </p>
          </div>
        </div>
      </section>
    )
  }

  // ── os 3 cards ────────────────────────────────────────────────────────────

  const receitasDespesasCard = (
    <div className={`bg-bg-surface rounded-lg ${pad}`}>
      <h3 className="text-sm font-medium text-text-primary mb-3">Receitas e despesas</h3>
      {/* Pareado (receita vs despesa lê-se junto) — mantém 2 colunas no mobile.
          Para o público high-income (valores de 6 dígitos), a cifra é menor no
          mobile (text-lg) + tabular-nums p/ caber a ~375px sem estourar; min-w-0
          + truncate + title são a rede de segurança p/ o caso extremo (7 dígitos). */}
      <div className="grid grid-cols-2 gap-4">
        <div className="min-w-0">
          <p className="text-xs text-text-muted mb-1">Receitas</p>
          <p
            className={`${isMobile ? 'text-lg' : 'text-xl'} font-medium tabular-nums text-success truncate`}
            title={formatBRL(receitas)}
          >
            {formatBRL(receitas)}
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-xs text-text-muted mb-1">Despesas</p>
          <p
            className={`${isMobile ? 'text-lg' : 'text-xl'} font-medium tabular-nums text-danger truncate`}
            title={formatBRL(despesas)}
          >
            {formatBRL(despesas)}
          </p>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-bg-border">
        <p className="text-xs text-text-muted mb-1">Resultado do mês</p>
        <p className={`text-lg font-medium ${resultadoColor(resultado)}`}>{formatBRL(resultado)}</p>
      </div>
    </div>
  )

  const categoriaCard = (
    <div className={`bg-bg-surface rounded-lg ${pad}`}>
      <h3 className="text-sm font-medium text-text-primary mb-3">
        Gasto por categoria · {MONTHS[mes - 1]}
      </h3>
      <DonutChart data={cats} showValues size="lg" />
    </div>
  )

  const destaquesCard = (
    <div className={`bg-bg-surface rounded-lg ${pad}`}>
      <h3 className="text-sm font-medium text-text-primary mb-4">Destaques</h3>
      {hlError || !highlights ? (
        <p className="text-text-muted text-sm">Não foi possível carregar os destaques.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Maior despesa */}
          <div>
            <p className="text-xs text-text-muted mb-1">Maior despesa</p>
            {highlights.maior_despesa ? (
              <>
                <p className="text-base font-medium text-danger">
                  {formatBRL(highlights.maior_despesa.valor)}
                </p>
                <p className="text-sm text-text-primary truncate">
                  {highlights.maior_despesa.descricao}
                </p>
                <p className="text-xs text-text-muted">
                  {highlights.maior_despesa.categoria} · {formatDate(highlights.maior_despesa.data)}
                </p>
              </>
            ) : (
              <p className="text-sm text-text-muted">Sem despesas neste mês</p>
            )}
          </div>

          {/* Dia de maior gasto */}
          <div>
            <p className="text-xs text-text-muted mb-1">Dia de maior gasto</p>
            {highlights.dia_maior_gasto ? (
              <p className="text-sm text-text-primary">
                {formatDate(highlights.dia_maior_gasto.data)} ·{' '}
                <span className="text-danger font-medium">
                  {formatBRL(highlights.dia_maior_gasto.total)}
                </span>
              </p>
            ) : (
              <p className="text-sm text-text-muted">—</p>
            )}
          </div>

          {/* Movimentações — total em destaque + decomposição aditiva. */}
          <div>
            <p className="text-xs text-text-muted mb-1">Movimentações</p>
            <p className="text-base font-medium text-text-primary">
              {plural(highlights.num_transacoes_total, 'movimentação', 'movimentações')}
            </p>
            {highlights.num_recorrentes > 0 && (
              <p className="text-xs text-text-muted">
                {plural(highlights.num_lancadas, 'lançada', 'lançadas')}
                {' + '}
                {plural(highlights.num_recorrentes, 'recorrente', 'recorrentes')}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )

  // Consumo por cartão: barras proporcionais à MAIOR entre todos os itens
  // exibidos (a maior = 100%). "Sem cartão" só entra quando > 0 (nunca R$0).
  const cartoes: GastoCartaoItem[] = spending?.cartoes ?? []
  const semCartao = spending?.sem_cartao ?? 0
  const hasSemCartao = semCartao > 0
  // A soma visual (cartões + sem cartão) bate com `despesas` — invariante do backend.
  const maxCartao = Math.max(...cartoes.map((c) => c.total), hasSemCartao ? semCartao : 0, 0)
  const barPct = (v: number) => (maxCartao > 0 ? (v / maxCartao) * 100 : 0)
  // O card só aparece quando há o que mostrar; some no mês só-receita (coerente
  // com o resto da Seção 1). Em erro, degrada com uma linha muda (não some).
  const showCartaoCard = spendingError || cartoes.length > 0 || hasSemCartao

  const cartaoCard = showCartaoCard ? (
    <div className={`bg-bg-surface rounded-lg ${pad}`}>
      <h3 className="text-sm font-medium text-text-primary">Consumo por cartão</h3>
      {/* Rótulo que distingue de FATURA: aqui é o que foi GASTO no mês, não o que
          vence (a fatura vive na tela de Cartões). Conecta consumo→fatura para
          explicar por que Consumo aqui pode conviver com Fatura R$0 em Cartões
          (compras deste mês só vencem conforme o fechamento de cada cartão). */}
      <p className="text-xs text-text-muted mb-4">
        Volume de despesas do mês. Compras parceladas entram pelo valor cheio, não pela parcela.
      </p>
      {spendingError || !spending ? (
        <p className="text-text-muted text-sm">Não foi possível carregar o consumo por cartão.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {cartoes.map((c) => (
            <SpendingBarRow
              key={c.cartao_id}
              nome={c.cartao_nome}
              valor={c.total}
              pct={barPct(c.total)}
            />
          ))}
          {hasSemCartao && (
            <SpendingBarRow nome="Sem cartão" valor={semCartao} pct={barPct(semCartao)} muted />
          )}
        </div>
      )}
    </div>
  ) : null

  // ── layout ────────────────────────────────────────────────────────────────
  // Mobile: empilhado (composição → donut → cartão → destaques). Os dois breakdowns
  // (por categoria e por cartão) ficam adjacentes.
  // Desktop: coluna esquerda (45%) = donut + cartão; direita = composição +
  // destaques — espelha o grid do Dashboard (grid-cols-[45%_1fr]).
  return (
    <section className="flex flex-col gap-4">
      <SectionHeader mes={mes} ano={ano} />

      {isMobile ? (
        <div className="flex flex-col gap-4">
          {receitasDespesasCard}
          {categoriaCard}
          {cartaoCard}
          {destaquesCard}
        </div>
      ) : (
        <div className="grid grid-cols-[45%_1fr] gap-4">
          <div className="flex flex-col gap-4">
            {categoriaCard}
            {cartaoCard}
          </div>
          <div className="flex flex-col gap-4">
            {receitasDespesasCard}
            {destaquesCard}
          </div>
        </div>
      )}
    </section>
  )
}
