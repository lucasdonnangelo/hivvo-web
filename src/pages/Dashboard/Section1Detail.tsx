import { useMonthlyStats, useHighlights } from '../../hooks/useStatistics'
import DonutChart from '../../components/charts/DonutChart'

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
        <div className="h-56 bg-bg-surface rounded-lg animate-pulse" />
      </div>
    )
  }
  return (
    <div className="grid grid-cols-[45%_1fr] gap-4">
      <div className="h-96 bg-bg-surface rounded-lg animate-pulse" />
      <div className="flex flex-col gap-4">
        <div className="h-28 bg-bg-surface rounded-lg animate-pulse" />
        <div className="flex-1 bg-bg-surface rounded-lg animate-pulse" />
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

  const pad = isMobile ? 'p-4' : 'p-6'

  // Uma cohesão só: a seção aparece inteira quando ambas as fontes prontas.
  if (statsLoading || hlLoading) {
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

  // ── layout ────────────────────────────────────────────────────────────────
  // Mobile: empilhado (composição → donut → destaques).
  // Desktop: donut à esquerda (45%), composição + destaques à direita — espelha o
  // grid do Dashboard (grid-cols-[45%_1fr]).
  return (
    <section className="flex flex-col gap-4">
      <SectionHeader mes={mes} ano={ano} />

      {isMobile ? (
        <div className="flex flex-col gap-4">
          {receitasDespesasCard}
          {categoriaCard}
          {destaquesCard}
        </div>
      ) : (
        <div className="grid grid-cols-[45%_1fr] gap-4">
          {categoriaCard}
          <div className="flex flex-col gap-4">
            {receitasDespesasCard}
            {destaquesCard}
          </div>
        </div>
      )}
    </section>
  )
}
