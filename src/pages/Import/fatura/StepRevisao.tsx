import type {
  EnriquecimentoFaturaLinha,
  FaturaExtraida,
  ReconciliacaoFatura,
  TransacaoFatura,
} from '../../../services/importFatura'
import {
  formatBRL,
  formatParcela,
  formatPortador,
  isDespesaLinha,
  isEstornoLinha,
  motivoNaoDespesa,
  rotuloSugestao,
} from './helpers'

const catSelectClass =
  'w-full px-2 py-1.5 rounded-sm text-xs text-text-primary bg-bg border focus:outline-none focus:border-amber transition-colors'

interface StepRevisaoProps {
  isMobile: boolean
  fatura: FaturaExtraida
  reconciliacao: ReconciliacaoFatura
  // Auto-categoria por `indice` (join explícito). Ausente = linha sem sugestão.
  enriquecimento: Map<number, EnriquecimentoFaturaLinha>
  categorias: Record<number, string>
  apagadas: Record<number, true>
  categoriaOptions: string[]
  onSetCategoria: (idx: number, cat: string) => void
  onToggleApagar: (idx: number) => void
}

// ── Banner de reconciliação (sinal de qualidade da extração; NUNCA bloqueia) ──
function ReconBanner({ rec }: { rec: ReconciliacaoFatura }) {
  if (rec.bate) {
    return (
      <div className="rounded-md border border-success/40 bg-success/5 px-3 py-2.5 flex items-start gap-2">
        <span className="text-success text-sm leading-none mt-0.5">✓</span>
        <p className="text-xs text-text-primary">
          A fatura fecha — os lançamentos batem com o total informado pelo banco.
        </p>
      </div>
    )
  }
  const dif = Number(rec.diferenca) // soma_gastos - ancora
  const abs = formatBRL(Math.abs(dif))
  const frase =
    dif < 0
      ? `faltam ${abs} para bater com o total do banco`
      : `há ${abs} a mais em relação ao total do banco`
  return (
    <div className="rounded-md border border-amber/40 bg-amber/5 px-3 py-2.5 flex items-start gap-2">
      <span className="text-amber text-sm leading-none mt-0.5">⚠</span>
      <div className="flex flex-col gap-0.5">
        <p className="text-xs text-text-primary">Confira a fatura: {frase}.</p>
        <p className="text-xs text-text-muted">
          É só um aviso — você ainda pode importar. {formatBRL(Number(rec.soma_gastos))} em
          lançamentos contra {formatBRL(Number(rec.ancora))} declarados pelo banco.
        </p>
      </div>
    </div>
  )
}

export default function StepRevisao({
  isMobile,
  fatura,
  reconciliacao,
  enriquecimento,
  categorias,
  apagadas,
  categoriaOptions,
  onSetCategoria,
  onToggleApagar,
}: StepRevisaoProps) {
  const linhas = fatura.transacoes.map((t, idx) => ({ t, idx }))
  const despesas = linhas.filter(({ t }) => isDespesaLinha(t))
  // DUAS seções, não uma: o estorno é importado (vira crédito e abate o
  // consumo) e o resto não vira lançamento nenhum. Numa seção só, a frase de
  // topo teria de valer para os dois destinos — e a que existia negava a
  // importação para quem justamente é importado.
  const creditos = linhas.filter(({ t }) => isEstornoLinha(t))
  const foraDaImportacao = linhas.filter(
    ({ t }) => !isDespesaLinha(t) && !isEstornoLinha(t),
  )
  const ativas = despesas.filter(({ idx }) => !apagadas[idx]).length

  // A sugestão nasce SELECIONADA — senão a feature não faz nada. Precedência:
  // edição do usuário > sugestão do backend > 'Outros' (o neutro).
  const catValor = (idx: number) =>
    categorias[idx] ?? enriquecimento.get(idx)?.categoria_sugerida ?? 'Outros'

  // Se o valor atual (sugestão de categoria desativada entre o preview e agora)
  // não está nas opções, ele entra na lista — o select nunca coage em silêncio.
  //
  // Ela SOME da lista assim que o usuário escolhe outra, e isso é DELIBERADO,
  // não bug: a categoria desativada só estava ali porque era o valor vigente,
  // não porque voltou a ser oferecível. Mantê-la depois seria oferecer de volta
  // uma categoria que o próprio usuário desativou.
  const opcoesCom = (valor: string) =>
    categoriaOptions.includes(valor) ? categoriaOptions : [valor, ...categoriaOptions]

  // "Ainda é PROPOSTA?" — o rótulo quando sim, null quando não. Uma condição
  // só, consumida pela marca e pela borda (que precisam concordar sempre).
  //
  // Tocar no seletor DESLIGA a marca: ela significa "isto foi proposto, você
  // ainda não olhou". Enquanto ela some ao escolher, é impossível lê-la como
  // "confirmado" — que foi o erro do "✦ IA" em âmbar.
  const propostaDe = (idx: number): string | null =>
    categorias[idx] !== undefined
      ? null
      : rotuloSugestao(enriquecimento.get(idx)?.origem_sugestao ?? null)

  const marcaSugestao = (idx: number) => {
    const rotulo = propostaDe(idx)
    if (!rotulo) return null
    return (
      <span className="text-[11px] text-suggest flex items-center gap-1 whitespace-nowrap">
        <span aria-hidden>◇</span>
        {rotulo}
      </span>
    )
  }

  // Borda fria enquanto é proposta; borda normal assim que vira escolha.
  const borda = (idx: number) =>
    propostaDe(idx) ? 'border-suggest/40' : 'border-bg-border'

  // O ◇ é decorativo (aria-hidden) e o rótulo é um irmão do <select>, não algo
  // que o leitor de tela anuncie junto com o valor. Sem isto, quem não vê a
  // marca ouve "Alimentação" e não tem como saber que ninguém confirmou.
  const ariaCategoria = (t: TransacaoFatura, idx: number) => {
    const rotulo = propostaDe(idx)
    return `Categoria de ${t.descricao}${rotulo ? ` — ${rotulo}, ainda não confirmada` : ''}`
  }

  // ── Uma linha de despesa (mobile = card) ──
  // Funções (não componentes aninhados): chamadas como linhaMobile(t, idx) o JSX
  // é inline na árvore, sem novo tipo por render → o <select> não remonta ao editar.
  const linhaMobile = (t: TransacaoFatura, idx: number) => {
    const apagada = !!apagadas[idx]
    const parcela = formatParcela(t)
    return (
      <div
        key={idx}
        className={`rounded-md border p-3 flex flex-col gap-2 ${
          apagada ? 'border-bg-border bg-bg-surface opacity-50' : 'border-bg-border bg-bg-surface'
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-0.5 min-w-0">
            <span
              className={`text-sm text-text-primary truncate ${apagada ? 'line-through' : ''}`}
            >
              {t.descricao}
            </span>
            <span className="text-xs text-text-muted">
              {t.data}
              {parcela ? ` · parcela ${parcela}` : ''} · {formatPortador(t)}
            </span>
          </div>
          <span className={`text-sm text-text-primary shrink-0 ${apagada ? 'line-through' : ''}`}>
            {formatBRL(Number(t.valor_brl))}
          </span>
        </div>
        {apagada ? (
          <button
            onClick={() => onToggleApagar(idx)}
            className="self-start text-xs text-amber hover:text-amber-light transition-colors"
          >
            Restaurar linha
          </button>
        ) : (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <select
                value={catValor(idx)}
                onChange={(e) => onSetCategoria(idx, e.target.value)}
                className={`${catSelectClass} ${borda(idx)}`}
                aria-label={ariaCategoria(t, idx)}
              >
                {opcoesCom(catValor(idx)).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <button
                onClick={() => onToggleApagar(idx)}
                className="shrink-0 w-8 h-8 flex items-center justify-center rounded text-text-muted hover:text-danger hover:bg-bg-border transition-colors text-xs"
                aria-label={`Apagar ${t.descricao}`}
              >
                ✕
              </button>
            </div>
            {marcaSugestao(idx)}
          </div>
        )}
      </div>
    )
  }

  // ── Uma linha de despesa (desktop = <tr>) ── (função, ver nota em linhaMobile)
  const linhaDesktop = (t: TransacaoFatura, idx: number) => {
    const apagada = !!apagadas[idx]
    const parcela = formatParcela(t)
    return (
      <tr key={idx} className={`border-b border-bg-border ${apagada ? 'opacity-50' : ''}`}>
        <td className="py-2 pr-3 text-xs text-text-muted whitespace-nowrap align-top">{t.data}</td>
        <td className="py-2 pr-3 align-top">
          <span className={`text-sm text-text-primary ${apagada ? 'line-through' : ''}`}>
            {t.descricao}
          </span>
          {parcela && (
            <span className="ml-2 text-[11px] text-text-muted whitespace-nowrap">
              parcela {parcela}
            </span>
          )}
        </td>
        <td className="py-2 pr-3 text-xs text-text-muted whitespace-nowrap align-top">
          {formatPortador(t)}
        </td>
        <td
          className={`py-2 pr-3 text-sm text-text-primary text-right whitespace-nowrap align-top ${
            apagada ? 'line-through' : ''
          }`}
        >
          {formatBRL(Number(t.valor_brl))}
        </td>
        <td className="py-2 pr-3 align-top w-44">
          {apagada ? (
            <span className="text-xs text-text-muted">removida</span>
          ) : (
            <div className="flex flex-col gap-1">
              <select
                value={catValor(idx)}
                onChange={(e) => onSetCategoria(idx, e.target.value)}
                className={`${catSelectClass} ${borda(idx)}`}
                aria-label={ariaCategoria(t, idx)}
              >
                {opcoesCom(catValor(idx)).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              {marcaSugestao(idx)}
            </div>
          )}
        </td>
        <td className="py-2 align-top text-right">
          {apagada ? (
            <button
              onClick={() => onToggleApagar(idx)}
              className="text-xs text-amber hover:text-amber-light transition-colors"
            >
              Restaurar
            </button>
          ) : (
            <button
              onClick={() => onToggleApagar(idx)}
              className="w-8 h-8 flex items-center justify-center rounded text-text-muted hover:text-danger hover:bg-bg-border transition-colors text-xs"
              aria-label={`Apagar ${t.descricao}`}
            >
              ✕
            </button>
          )}
        </td>
      </tr>
    )
  }

  // ── Uma linha read-only das DUAS seções de baixo ── (função, ver linhaMobile)
  // Markup idêntico nas duas: o que muda entre crédito e fora-da-importação é o
  // destino, e ele é dito pelo título/frase da seção e pelo motivo da linha.
  const linhaCinza = (t: TransacaoFatura, idx: number) => (
    <div
      key={idx}
      className="rounded-md border border-bg-border bg-bg px-3 py-2.5 flex items-start justify-between gap-2"
    >
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-sm text-text-muted truncate">{t.descricao}</span>
        <span className="text-[11px] text-text-muted">{motivoNaoDespesa(t)}</span>
      </div>
      {/* O valor do crédito fica em text-muted, NÃO em âmbar — mesmo o
          StepRecibo usando âmbar para "estornos importados". Lá o estorno é o
          resultado, sozinho na tela; aqui âmbar já significa "selecionado" (o
          foco do seletor de categoria, logo acima) e "atenção" (o banner de
          reconciliação, logo abaixo). Um terceiro sentido na mesma tela é
          exatamente o erro que a marca de sugestão acabou de pagar — o "✦ IA"
          âmbar lido como "confirmado". Aqui o destino é dito por escrito. */}
      <span className="text-sm text-text-muted shrink-0">{formatBRL(Number(t.valor_brl))}</span>
    </div>
  )

  return (
    <div className="flex flex-col gap-5">
      <ReconBanner rec={reconciliacao} />

      {/* ── Despesas ── */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-text-primary">
            Despesas ({ativas})
          </h2>
          <span className="text-xs text-text-muted">{fatura.banco}</span>
        </div>

        {despesas.length === 0 ? (
          <p className="text-sm text-text-muted py-4 text-center">
            Nenhuma despesa reconhecida nesta fatura.
          </p>
        ) : isMobile ? (
          <div className="flex flex-col gap-2">
            {despesas.map(({ t, idx }) => linhaMobile(t, idx))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-bg-border text-left">
                  <th className="py-2 pr-3 text-[11px] font-medium text-text-muted uppercase tracking-wide">Data</th>
                  <th className="py-2 pr-3 text-[11px] font-medium text-text-muted uppercase tracking-wide">Descrição</th>
                  <th className="py-2 pr-3 text-[11px] font-medium text-text-muted uppercase tracking-wide">Portador</th>
                  <th className="py-2 pr-3 text-[11px] font-medium text-text-muted uppercase tracking-wide text-right">Valor</th>
                  <th className="py-2 pr-3 text-[11px] font-medium text-text-muted uppercase tracking-wide">Categoria</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {despesas.map(({ t, idx }) => linhaDesktop(t, idx))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Entram como CRÉDITO (estornos): read-only, mas importadas ── */}
      {creditos.length > 0 && (
        <div className="flex flex-col gap-2">
          {/* Título em text-primary, e não no muted da seção de baixo: isto é
              conteúdo que vai ser gravado, do mesmo peso que "Despesas". */}
          <h2 className="text-sm font-medium text-text-primary">Entram como crédito</h2>
          <p className="text-xs text-text-muted">
            Estornos reconhecidos na fatura. Não são gastos — são importados como crédito e abatem
            o consumo.
          </p>
          <div className="flex flex-col gap-2">
            {creditos.map(({ t, idx }) => linhaCinza(t, idx))}
          </div>
        </div>
      )}

      {/* ── Não entram na importação (read-only) ── */}
      {foraDaImportacao.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-text-muted">Não entram na importação</h2>
          <p className="text-xs text-text-muted">
            Estas linhas foram reconhecidas na fatura, mas não viram lançamento — nem gasto, nem
            crédito.
          </p>
          <div className="flex flex-col gap-2">
            {foraDaImportacao.map(({ t, idx }) => linhaCinza(t, idx))}
          </div>
        </div>
      )}
    </div>
  )
}
