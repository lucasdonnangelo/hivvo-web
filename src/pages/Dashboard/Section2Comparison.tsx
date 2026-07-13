import { useState } from 'react'
import { useComparison } from '../../hooks/useStatistics'
import type { CategoriaComparacao } from '../../services/statistics'

// ─── Seção 2 "Comparação" ─────────────────────────────────────────────────────
//
// Aparece com coverage ≥ 2 (há mês anterior). Fonte: GET /comparison?meses=3.
// Base CONSUMO. O endpoint devolve MUITO dado (totais + todas as categorias com
// atual/anterior/média e variações) — o design é CURADORIA em 3 níveis:
//   1. Manchete: "gastei mais ou menos?" (despesas + receitas, vs anterior/média).
//   2. Onde mudou: só as 3-4 categorias com maior variação EM R$ (não em %).
//   3. Ver todas: a tabela completa, escondida até pedir (useState).
//
// Florescimento interno da média: a leitura "vs média" só aparece com coverage ≥ 3
// (≥2 meses fechados); com coverage == 2 a média ≈ o anterior (redundante) → só
// mostramos "vs [mês anterior]".

// ─── helpers ────────────────────────────────────────────────────────────────

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

const formatBRL = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

// % assinado, arredondado a inteiro (o backend dá 2 casas; a prosa lê melhor
// inteiro). Guarda para |v|<1 (não vira "0%" enganoso). '−' = U+2212 (como o app).
const pctLabel = (v: number) => {
  const r = Math.round(Math.abs(v))
  if (r === 0) return '<1%'
  return `${v > 0 ? '+' : '−'}${r}%`
}

// Uma perna da manchete: "{X}% acima/abaixo {suffix}" (suffix já com preposição:
// "de junho" / "da sua média"). null quando não há base (anterior/média zero) →
// a manchete trata (mostra "sem base"); ~0 → "no mesmo nível".
const legPhrase = (v: number | null, suffix: string): string | null => {
  if (v == null) return null
  const r = Math.round(Math.abs(v))
  if (r === 0) return 'no mesmo nível'
  return `${r}% ${v > 0 ? 'acima' : 'abaixo'} ${suffix}`
}

// Cor por bom/ruim. upIsGood: receita (subir é bom); !upIsGood: despesa (subir
// é ruim). null / ~0 → neutro.
const dirColor = (v: number | null, upIsGood: boolean) => {
  if (v == null || Math.round(Math.abs(v)) === 0) return 'text-text-muted'
  return (v > 0) === upIsGood ? 'text-success' : 'text-danger'
}

// Cor de uma variação de DESPESA por categoria: subiu (gastou mais / nova) = danger;
// desceu = success; ~0 = neutro.
const despVarColor = (v: number | null) => {
  if (v == null) return 'text-danger' // categoria nova = gasto que surgiu (subiu)
  if (Math.round(Math.abs(v)) === 0) return 'text-text-muted'
  return v > 0 ? 'text-danger' : 'text-success'
}

// Célula de variação na tabela: "nova" quando não há base (anterior/média zero).
const varCell = (v: number | null) => (v == null ? 'nova' : pctLabel(v))

// ─── sub-components ─────────────────────────────────────────────────────────

function SectionHeader({ atualNome, anteriorNome }: { atualNome: string; anteriorNome: string }) {
  return (
    <div>
      <h2 className="text-lg font-medium text-text-primary">Comparação</h2>
      <p className="text-sm text-text-muted">{atualNome} vs {anteriorNome}</p>
    </div>
  )
}

// Nível 1 — uma manchete (despesas ou receitas).
function Headline({
  label,
  valor,
  vAnt,
  vMed,
  anteriorNome,
  upIsGood,
  showMedia,
}: {
  label: string
  valor: number
  vAnt: number | null
  vMed: number | null
  anteriorNome: string
  upIsGood: boolean
  showMedia: boolean
}) {
  const antPhrase = legPhrase(vAnt, `de ${anteriorNome}`)
  const medPhrase = legPhrase(vMed, 'da sua média')
  return (
    <div>
      <p className="text-xs text-text-muted mb-1">{label}</p>
      <p className="text-2xl font-semibold text-text-primary">{formatBRL(valor)}</p>
      <p className="text-sm mt-0.5">
        {antPhrase ? (
          <span className={dirColor(vAnt, upIsGood)}>{antPhrase}</span>
        ) : (
          <span className="text-text-muted">sem base de comparação</span>
        )}
        {showMedia && medPhrase && <span className="text-text-muted"> · {medPhrase}</span>}
      </p>
    </div>
  )
}

// Nível 2 — uma linha de "onde mudou". Cor pelo SINAL do delta em R$ (despesa
// subiu = danger; desceu = success) — coerente com a seta.
function ChangeRow({ c, delta }: { c: CategoriaComparacao; delta: number }) {
  const badge = c.variacao_vs_anterior == null ? 'nova' : c.atual === 0 ? 'zerou' : pctLabel(c.variacao_vs_anterior)
  const valores =
    c.variacao_vs_anterior == null
      ? `${formatBRL(c.atual)} (novo)`
      : `${formatBRL(c.atual)} (era ${formatBRL(c.anterior)})`
  const color = delta > 0 ? 'text-danger' : 'text-success'
  return (
    <div className="py-2.5 border-b border-bg-border last:border-0">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-text-primary flex items-center gap-1.5 min-w-0">
          <span className={color}>{delta > 0 ? '↑' : '↓'}</span>
          <span className="truncate">{c.categoria}</span>
        </span>
        <span className={`text-sm font-medium shrink-0 ${color}`}>{badge}</span>
      </div>
      <p className="text-xs text-text-muted mt-0.5">{valores}</p>
    </div>
  )
}

// Nível 3 — tabela completa.
function FullTable({
  categorias,
  showMedia,
}: {
  categorias: CategoriaComparacao[]
  showMedia: boolean
}) {
  return (
    <div className="overflow-x-auto mt-3">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="text-text-muted text-left">
            <th className="font-medium py-2 pr-3">Categoria</th>
            <th className="font-medium py-2 px-2 text-right">Atual</th>
            <th className="font-medium py-2 px-2 text-right">Anterior</th>
            {showMedia && <th className="font-medium py-2 px-2 text-right">Média</th>}
            <th className="font-medium py-2 px-2 text-right">vs ant.</th>
            {showMedia && <th className="font-medium py-2 pl-2 text-right">vs média</th>}
          </tr>
        </thead>
        <tbody>
          {categorias.map((c) => (
            <tr key={c.categoria} className="border-t border-bg-border">
              <td className="py-2 pr-3 text-text-primary whitespace-nowrap">{c.categoria}</td>
              <td className="py-2 px-2 text-right tabular-nums text-text-primary whitespace-nowrap">
                {formatBRL(c.atual)}
              </td>
              <td className="py-2 px-2 text-right tabular-nums text-text-muted whitespace-nowrap">
                {formatBRL(c.anterior)}
              </td>
              {showMedia && (
                <td className="py-2 px-2 text-right tabular-nums text-text-muted whitespace-nowrap">
                  {formatBRL(c.media)}
                </td>
              )}
              <td className={`py-2 px-2 text-right tabular-nums whitespace-nowrap ${despVarColor(c.variacao_vs_anterior)}`}>
                {varCell(c.variacao_vs_anterior)}
              </td>
              {showMedia && (
                <td className={`py-2 pl-2 text-right tabular-nums whitespace-nowrap ${despVarColor(c.variacao_vs_media)}`}>
                  {varCell(c.variacao_vs_media)}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Section2Skeleton({ isMobile }: { isMobile: boolean }) {
  const pad = isMobile ? 'p-4' : 'p-6'
  return (
    <div className="flex flex-col gap-4">
      <div className={`bg-bg-surface rounded-lg ${pad}`}>
        <div className="h-20 bg-bg rounded-md animate-pulse" />
      </div>
      <div className="h-56 bg-bg-surface rounded-lg animate-pulse" />
    </div>
  )
}

// ─── section ─────────────────────────────────────────────────────────────────

export default function Section2Comparison({
  coverage,
  isMobile,
}: {
  coverage: number
  isMobile: boolean
}) {
  // "Ver todas" — UI-state local (não persiste).
  const [expanded, setExpanded] = useState(false)
  const { data: comp, isLoading, isError } = useComparison(3)

  const now = new Date()
  const atualNome = MONTHS[now.getMonth()]
  const anteriorNome = MONTHS[(now.getMonth() + 11) % 12]

  // "vs média" floresce só com ≥2 meses fechados (coverage ≥ 3).
  const showMedia = coverage >= 3
  const pad = isMobile ? 'p-4' : 'p-6'

  if (isLoading) {
    return (
      <section className="flex flex-col gap-4">
        <SectionHeader atualNome={atualNome} anteriorNome={anteriorNome} />
        <Section2Skeleton isMobile={isMobile} />
      </section>
    )
  }

  if (isError || !comp) {
    return (
      <section className="flex flex-col gap-4">
        <SectionHeader atualNome={atualNome} anteriorNome={anteriorNome} />
        <div className={`bg-bg-surface rounded-lg ${pad}`}>
          <p className="text-text-muted text-sm">
            Não foi possível carregar a comparação. Tente novamente.
          </p>
        </div>
      </section>
    )
  }

  const t = comp.totais

  // Nível 2 — top 4 por MAIOR variação em R$ (|atual − anterior|), não em %.
  // Mistura altas e baixas (o sort por |delta| já faz isso). Filtra delta ~0.
  const changes = comp.categorias
    .map((c) => ({ c, delta: c.atual - c.anterior }))
    .filter((x) => Math.abs(x.delta) > 0.005)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 4)

  return (
    <section className="flex flex-col gap-4">
      <SectionHeader atualNome={atualNome} anteriorNome={anteriorNome} />

      {/* Nível 1 — manchete: despesas + receitas. */}
      <div className={`bg-bg-surface rounded-lg ${pad}`}>
        <div className={isMobile ? 'flex flex-col gap-4' : 'grid grid-cols-2 gap-4'}>
          <Headline
            label="Despesas"
            valor={t.atual.despesas}
            vAnt={t.variacao_vs_anterior.despesas}
            vMed={t.variacao_vs_media.despesas}
            anteriorNome={anteriorNome}
            upIsGood={false}
            showMedia={showMedia}
          />
          <Headline
            label="Receitas"
            valor={t.atual.receitas}
            vAnt={t.variacao_vs_anterior.receitas}
            vMed={t.variacao_vs_media.receitas}
            anteriorNome={anteriorNome}
            upIsGood
            showMedia={showMedia}
          />
        </div>
      </div>

      {/* Nível 2 "Onde mudou" + Nível 3 "Ver todas". */}
      <div className={`bg-bg-surface rounded-lg ${pad}`}>
        <h3 className="text-sm font-medium text-text-primary mb-1">Onde mudou</h3>
        <p className="text-xs text-text-muted mb-3">Maiores variações vs {anteriorNome}</p>

        {changes.length === 0 ? (
          <p className="text-text-muted text-sm">Sem variações por categoria neste mês.</p>
        ) : (
          <div>
            {changes.map(({ c, delta }) => (
              <ChangeRow key={c.categoria} c={c} delta={delta} />
            ))}
          </div>
        )}

        {comp.categorias.length > 0 && (
          <>
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-4 text-sm font-medium text-amber hover:opacity-80 transition-opacity rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-amber"
            >
              {expanded ? 'Ver menos' : `Ver todas as categorias (${comp.categorias.length})`}
            </button>
            {expanded && <FullTable categorias={comp.categorias} showMedia={showMedia} />}
          </>
        )}
      </div>
    </section>
  )
}
