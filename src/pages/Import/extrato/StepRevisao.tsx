import type {
  EnriquecimentoLinha,
  ExtratoExtraido,
  LinhaExtrato,
  ReconciliacaoExtrato,
} from '../../../services/importExtrato'
import {
  formatBRL,
  formatCompetencia,
  neutralBadge,
  presentBalde,
  resolverProposta,
} from './helpers'
import { ariaDataExtrato, avisoDataExtrato, marcaData } from '../dataSuspeita'
import { presentTipo } from '../../../lib/tipoTransacao'

const catSelectClass =
  'w-full px-2 py-1.5 rounded-sm text-xs text-text-primary bg-bg border border-bg-border focus:outline-none focus:border-amber transition-colors'

const dateInputClass =
  'px-3 py-2 rounded-sm text-sm text-text-primary bg-bg-surface border border-bg-border focus:outline-none focus:border-amber transition-colors'

interface StepRevisaoProps {
  isMobile: boolean
  extrato: ExtratoExtraido
  reconciliacao: ReconciliacaoExtrato
  // join por `indice` explícito (Map montado no container) — nunca por posição
  enriquecimento: Map<number, EnriquecimentoLinha>
  importar: Record<number, boolean>
  // só EDIÇÕES; o default por linha é categoria_sugerida ?? 'Outros'
  categorias: Record<number, string>
  // #48 — receitas marcadas como dinheiro de volta (viram tipo="estorno")
  reembolso: Record<number, true>
  // índice em candidatas por linha; default 0 (a primeira, ordenada por confiança)
  candidataEscolhida: Record<number, number>
  categoriasReceita: string[]
  categoriasDespesa: string[]
  importarRendimento: boolean
  // editor só aparece quando o extrato não imprime o período (o commit o exige)
  periodoFaltante: boolean
  periodoDe: string
  periodoAte: string
  // O usuário mexeu na ÂNCORA (o período) sem poder mexer nas datas checadas —
  // então todo `data_suspeita` calculado no preview virou OBSOLETO. Aqui isso
  // apaga as marcas e acende o aviso: flag obsoleto exibido como válido é PIOR
  // que flag nenhum, porque ensina o usuário a ignorar aviso.
  datasNaoReverificadas: boolean
  onToggleImportar: (idx: number) => void
  onSetCategoria: (idx: number, cat: string) => void
  onToggleReembolso: (idx: number) => void
  onSetCandidata: (idx: number, i: number) => void
  onToggleRendimento: () => void
  onSetPeriodo: (campo: 'de' | 'ate', valor: string) => void
  error: string
}

// ── Banner do balance walk (sinal de qualidade; NUNCA bloqueia). Três estados:
// fecha (verde) · não fecha (âmbar, aviso) · não aplicável (neutro — o extrato
// não imprime os saldos, não há o que conferir). ──
function WalkBanner({ rec }: { rec: ReconciliacaoExtrato }) {
  if (!rec.aplicavel) {
    return (
      <div className="rounded-md border border-bg-border bg-bg-surface px-3 py-2.5 flex items-start gap-2">
        <span className="text-text-muted text-sm leading-none mt-0.5">·</span>
        <p className="text-xs text-text-muted">
          O extrato não imprime os saldos — não dá para conferir o fechamento. Revise as
          linhas normalmente.
        </p>
      </div>
    )
  }
  if (rec.bate) {
    return (
      <div className="rounded-md border border-success/40 bg-success/5 px-3 py-2.5 flex items-start gap-2">
        <span className="text-success text-sm leading-none mt-0.5">✓</span>
        <p className="text-xs text-text-primary">
          O extrato fecha — as movimentações batem com os saldos informados pelo banco.
        </p>
      </div>
    )
  }
  const dif = Number(rec.diferenca) // saldo_final_calc − saldo_final_declarado
  const abs = formatBRL(Math.abs(dif))
  const frase =
    dif < 0
      ? `faltam ${abs} para chegar ao saldo declarado`
      : `há ${abs} a mais em relação ao saldo declarado`
  return (
    <div className="rounded-md border border-amber/40 bg-amber/5 px-3 py-2.5 flex items-start gap-2">
      <span className="text-amber text-sm leading-none mt-0.5">⚠</span>
      <div className="flex flex-col gap-0.5">
        <p className="text-xs text-text-primary">Confira o extrato: {frase}.</p>
        <p className="text-xs text-text-muted">
          É só um aviso — você ainda pode importar. Saldo calculado{' '}
          {formatBRL(Number(rec.saldo_final_calc))} contra{' '}
          {formatBRL(Number(rec.saldo_final_declarado))} declarado pelo banco.
        </p>
      </div>
    </div>
  )
}

export default function StepRevisao({
  isMobile,
  extrato,
  reconciliacao,
  enriquecimento,
  importar,
  categorias,
  reembolso,
  candidataEscolhida,
  categoriasReceita,
  categoriasDespesa,
  importarRendimento,
  periodoFaltante,
  periodoDe,
  periodoAte,
  datasNaoReverificadas,
  onToggleImportar,
  onSetCategoria,
  onToggleReembolso,
  onSetCandidata,
  onToggleRendimento,
  onSetPeriodo,
  error,
}: StepRevisaoProps) {
  const linhas = extrato.linhas.map((l, idx) => ({ l, idx, enr: enriquecimento.get(idx) }))
  const receitas = linhas.filter(({ l }) => l.balde === 'receita')
  const debitos = linhas.filter(({ l }) => l.balde === 'debito')
  const pagamentos = linhas.filter(({ l }) => l.balde === 'pagamento_fatura')
  // fallback neutro: balde fora da união conhecida — exibidas, nunca importadas
  const desconhecidas = linhas.filter(({ l }) => !presentBalde(l.balde).known)

  const rendimento = Number(extrato.rendimento)

  // ── #48: dinheiro de volta. A linha continua NASCENDO receita (o modelo não
  // tem como saber se um "Pix recebido — FULANO" é salário, devolução de loja
  // ou o amigo pagando de volta) e o usuário marca as que não são renda. Ela
  // vira tipo="estorno": abate o gasto do mês em vez de inflar a receita. ──
  const ehReembolso = (l: LinhaExtrato, idx: number) =>
    l.balde === 'receita' && !!reembolso[idx]

  // Estorno é gasto que VOLTOU, então a categoria dele vive no universo de
  // DESPESA — o backend recomputa nesse universo. Trocar a lista aqui é o que
  // impede a tela de afirmar uma categoria que o servidor vai rebaixar a
  // "Outros" sem ninguém ver.
  const opcoesDaLinha = (reemb: boolean, opcoes: string[]) =>
    reemb ? categoriasDespesa : opcoes

  // Marcada, a sugestão do backend NÃO serve de default: ela foi calculada no
  // universo de receita. 'Outros' é o mesmo que o servidor gravaria.
  const catValor = (idx: number, enr: EnriquecimentoLinha | undefined, reemb: boolean) =>
    reemb
      ? (categorias[idx] ?? 'Outros')
      : (categorias[idx] ?? enr?.categoria_sugerida ?? 'Outros')

  // Se o valor atual (ex.: sugestão do backend de categoria já desativada) não
  // está nas opções, ele entra na lista — o select nunca coage em silêncio.
  const opcoesCom = (valor: string, opcoes: string[]) =>
    opcoes.includes(valor) ? opcoes : [valor, ...opcoes]

  // Apresentação da linha marcada: o MESMO âmbar + selo que `presentTipo` já dá
  // ao estorno na lista, no dashboard e no recibo — fonte única, não um quinto
  // sentido do âmbar. A revisão passa a parecer com o resultado.
  const presentLinha = (l: LinhaExtrato, reemb: boolean) =>
    reemb ? presentTipo('estorno') : { ...presentBalde(l.balde), badge: null, badgeClass: '' }

  // O controle por linha, idêntico nos dois layouts: mora COLADO no seletor de
  // categoria porque marcar troca a lista dele — ver as duas coisas juntas é o
  // que torna a troca legível.
  const controleReembolso = (l: LinhaExtrato, idx: number) => (
    <label className="flex items-start gap-2 cursor-pointer mt-1.5">
      <input
        type="checkbox"
        checked={!!reembolso[idx]}
        onChange={() => onToggleReembolso(idx)}
        className="accent-amber w-3.5 h-3.5 mt-px shrink-0"
        aria-label={`Marcar ${l.descricao} como dinheiro de volta`}
      />
      <span className="text-[11px] text-text-muted leading-tight">
        Dinheiro de volta (não é renda)
      </span>
    </label>
  )

  const marcadas = (grupo: typeof linhas) =>
    grupo.filter(({ idx }) => importar[idx]).length

  // ── Data suspeita: a linha caiu fora do período do extrato. Diferente do
  // aviso de recorrência abaixo em uma coisa que importa: aquele EXPLICA uma
  // linha que já nasceu desmarcada; este NÃO desmarca nada. Um falso positivo
  // que desmarcasse sozinho sumiria com uma transação real, e o usuário não vê
  // o que não está lá — então aqui a regra só sinaliza.
  //
  // `datasNaoReverificadas` zera tudo numa condição só, no ponto mais alto: se
  // o usuário mexeu no período, nenhum flag desta tela foi calculado contra ele.
  const suspeitaDe = (enr: EnriquecimentoLinha | undefined) =>
    datasNaoReverificadas ? null : (enr?.data_suspeita ?? null)

  // A faixa citada na cópia é o período do DOCUMENTO — o que o backend usou como
  // âncora — e nunca o digitado, que não reverificou nada.
  const avisoData = (enr: EnriquecimentoLinha | undefined) =>
    avisoDataExtrato(suspeitaDe(enr), extrato.periodo)

  // ── Aviso de recorrência (a armadilha do salário): visível SEMPRE que a
  // receita foi flagada — explica por que nasceu desmarcada; marcar continua
  // possível. ──
  const avisoRecorrencia = (enr: EnriquecimentoLinha | undefined) => {
    if (!enr?.provavel_recorrencia) return null
    const rec = enr.recorrencia_casada
    return (
      <p className="text-[11px] text-amber flex items-start gap-1">
        <span aria-hidden className="mt-px">⚠</span>
        <span>
          {rec
            ? `Provavelmente já é a recorrência “${rec.descricao}” (${formatBRL(
                Number(rec.valor_vigente),
              )}, dia ${rec.dia_do_mes}) — importar duplicaria a receita.`
            : 'Provavelmente já coberta por uma recorrência — importar duplicaria a receita.'}
        </span>
      </p>
    )
  }

  // ── Uma linha de receita/débito (mobile = card). Funções, não componentes
  // aninhados: o JSX entra inline na árvore, sem novo tipo por render → o
  // <select> não remonta ao editar (mesma nota do StepRevisao da fatura). ──
  const linhaMobile = (l: LinhaExtrato, idx: number, enr: EnriquecimentoLinha | undefined, opcoes: string[]) => {
    const marcada = !!importar[idx]
    const reemb = ehReembolso(l, idx)
    const pres = presentLinha(l, reemb)
    const opcoesLinha = opcoesDaLinha(reemb, opcoes)
    return (
      <div
        key={idx}
        className={`rounded-md border border-bg-border bg-bg-surface p-3 flex flex-col gap-2 ${
          marcada ? '' : 'opacity-60'
        }`}
      >
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={marcada}
            onChange={() => onToggleImportar(idx)}
            className="accent-amber w-4 h-4 mt-0.5"
            aria-label={`Importar ${l.descricao}${ariaDataExtrato(suspeitaDe(enr))}`}
          />
          <div className="flex flex-col gap-0.5 min-w-0 flex-1">
            <span className="text-sm text-text-primary truncate">
              {l.descricao}
              {pres.badge && (
                <span
                  className={`ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${pres.badgeClass}`}
                >
                  {pres.badge}
                </span>
              )}
            </span>
            <span className="text-xs text-text-muted">{marcaData(l.data, suspeitaDe(enr))}</span>
          </div>
          <span className={`text-sm shrink-0 ${pres.amountClass}`}>
            {pres.sign}
            {formatBRL(Number(l.valor))}
          </span>
        </label>
        {avisoData(enr)}
        {avisoRecorrencia(enr)}
        {marcada && (
          <div className="flex flex-col">
            <select
              value={catValor(idx, enr, reemb)}
              onChange={(e) => onSetCategoria(idx, e.target.value)}
              className={catSelectClass}
              aria-label={`Categoria de ${l.descricao}`}
            >
              {opcoesCom(catValor(idx, enr, reemb), opcoesLinha).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            {l.balde === 'receita' && controleReembolso(l, idx)}
          </div>
        )}
      </div>
    )
  }

  // ── Uma linha de receita/débito (desktop = <tr>) ──
  const linhaDesktop = (l: LinhaExtrato, idx: number, enr: EnriquecimentoLinha | undefined, opcoes: string[]) => {
    const marcada = !!importar[idx]
    const reemb = ehReembolso(l, idx)
    const pres = presentLinha(l, reemb)
    const opcoesLinha = opcoesDaLinha(reemb, opcoes)
    return (
      <tr key={idx} className={`border-b border-bg-border ${marcada ? '' : 'opacity-60'}`}>
        <td className="py-2 pr-3 align-top">
          <input
            type="checkbox"
            checked={marcada}
            onChange={() => onToggleImportar(idx)}
            className="accent-amber w-4 h-4 mt-0.5"
            aria-label={`Importar ${l.descricao}${ariaDataExtrato(suspeitaDe(enr))}`}
          />
        </td>
        <td className="py-2 pr-3 text-xs text-text-muted whitespace-nowrap align-top">
          {marcaData(l.data, suspeitaDe(enr))}
        </td>
        {/* A frase vai na célula de DESCRIÇÃO (a marca fica na data): a coluna de
            data é whitespace-nowrap e estreita, e uma frase ali estouraria a
            tabela — mesma escolha do StepRevisao da fatura. */}
        <td className="py-2 pr-3 align-top">
          <span className="text-sm text-text-primary">
            {l.descricao}
            {pres.badge && (
              <span
                className={`ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${pres.badgeClass}`}
              >
                {pres.badge}
              </span>
            )}
          </span>
          {avisoData(enr)}
          {avisoRecorrencia(enr)}
        </td>
        <td
          className={`py-2 pr-3 text-sm text-right whitespace-nowrap align-top ${pres.amountClass}`}
        >
          {pres.sign}
          {formatBRL(Number(l.valor))}
        </td>
        <td className="py-2 align-top w-44">
          {marcada ? (
            <>
              <select
                value={catValor(idx, enr, reemb)}
                onChange={(e) => onSetCategoria(idx, e.target.value)}
                className={catSelectClass}
                aria-label={`Categoria de ${l.descricao}`}
              >
                {opcoesCom(catValor(idx, enr, reemb), opcoesLinha).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              {l.balde === 'receita' && controleReembolso(l, idx)}
            </>
          ) : (
            <span className="text-xs text-text-muted">não importar</span>
          )}
        </td>
      </tr>
    )
  }

  // ── Seção de receitas/débitos (mobile = cards, desktop = tabela) ──
  const secaoLinhas = (
    titulo: string,
    grupo: typeof linhas,
    opcoes: string[],
    nota?: string,
  ) => {
    if (grupo.length === 0) return null
    return (
      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-text-primary">
          {titulo} ({marcadas(grupo)}/{grupo.length})
        </h2>
        {nota && <p className="text-xs text-text-muted">{nota}</p>}
        {isMobile ? (
          <div className="flex flex-col gap-2">
            {grupo.map(({ l, idx, enr }) => linhaMobile(l, idx, enr, opcoes))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-bg-border text-left">
                  <th className="py-2 pr-3 w-8" />
                  <th className="py-2 pr-3 text-[11px] font-medium text-text-muted uppercase tracking-wide">Data</th>
                  <th className="py-2 pr-3 text-[11px] font-medium text-text-muted uppercase tracking-wide">Descrição</th>
                  <th className="py-2 pr-3 text-[11px] font-medium text-text-muted uppercase tracking-wide text-right">Valor</th>
                  <th className="py-2 text-[11px] font-medium text-text-muted uppercase tracking-wide">Categoria</th>
                </tr>
              </thead>
              <tbody>
                {grupo.map(({ l, idx, enr }) => linhaDesktop(l, idx, enr, opcoes))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    )
  }

  // ── Indicador de confiança de uma candidata (valor_bate) + nota ja_paga ──
  const notasCandidata = (diferenca: string, valorBate: boolean, jaPaga: boolean) => (
    <span className="flex flex-col gap-0.5">
      {valorBate ? (
        <span className="text-[11px] text-success">✓ valor confere</span>
      ) : (
        <span className="text-[11px] text-amber">
          ⚠ difere {formatBRL(Math.abs(Number(diferenca)))} — pagamento parcial?
        </span>
      )}
      {jaPaga && (
        <span className="text-[11px] text-text-muted">
          essa fatura já constava paga — o valor será substituído pelo real do extrato
        </span>
      )}
    </span>
  )

  // ── Um pagamento de fatura (card nos dois layouts — radios não cabem em tabela) ──
  const cardPagamento = (l: LinhaExtrato, idx: number, enr: EnriquecimentoLinha | undefined) => {
    const proposta = resolverProposta(enr)

    // fora do import: sem_match, proposta ausente/vazia ou status desconhecido —
    // card cinza read-only, com selo neutro quando o status é desconhecido
    if (proposta.kind === 'fora') {
      const selo = proposta.known ? null : neutralBadge(proposta.status)
      return (
        <div
          key={idx}
          className="rounded-md border border-bg-border bg-bg px-3 py-2.5 flex flex-col gap-1"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-sm text-text-muted truncate">
                {l.descricao}
                {selo && (
                  <span
                    className={`ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${selo.className}`}
                  >
                    {selo.label}
                  </span>
                )}
              </span>
              <span className="text-[11px] text-text-muted">{l.data} · não será importado</span>
            </div>
            <span className="text-sm text-text-muted shrink-0">{formatBRL(Number(l.valor))}</span>
          </div>
          <p className="text-[11px] text-text-muted">{proposta.motivo}</p>
        </div>
      )
    }

    const marcada = !!importar[idx]
    const escolhida = candidataEscolhida[idx] ?? 0
    const ambigua = proposta.candidatas.length > 1

    return (
      <div
        key={idx}
        className={`rounded-md border border-bg-border bg-bg-surface p-3 flex flex-col gap-2 ${
          marcada ? '' : 'opacity-60'
        }`}
      >
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={marcada}
            onChange={() => onToggleImportar(idx)}
            className="accent-amber w-4 h-4 mt-0.5"
            aria-label={`Importar pagamento ${l.descricao}${ariaDataExtrato(suspeitaDe(enr))}`}
          />
          <div className="flex flex-col gap-0.5 min-w-0 flex-1">
            <span className="text-sm text-text-primary truncate">{l.descricao}</span>
            <span className="text-xs text-text-muted">{marcaData(l.data, suspeitaDe(enr))}</span>
          </div>
          <span className="text-sm text-text-primary shrink-0">
            −{formatBRL(Number(l.valor))}
          </span>
        </label>
        {/* Só no card CONFIRMÁVEL. O card 'fora' (sem_match/status desconhecido)
            já diz por escrito "não será importado" — uma linha que não entra não
            precisa de aviso sobre a competência em que ela não vai cair, e a
            ação da cópia ("desmarque a linha") nem existe lá. */}
        {avisoData(enr)}

        {marcada &&
          (ambigua ? (
            <div className="flex flex-col gap-1.5 pl-7">
              <p className="text-[11px] text-amber">
                ⚠ Mais de uma fatura pode ser a quitada — confirme qual.
              </p>
              {proposta.candidatas.map((c, i) => (
                <label
                  key={`${c.cartao_id}-${c.fatura_mes}-${c.fatura_ano}`}
                  className="flex items-start gap-2.5 px-3 py-2 rounded-md border border-bg-border bg-bg cursor-pointer"
                >
                  <input
                    type="radio"
                    name={`pf-${idx}`}
                    checked={escolhida === i}
                    onChange={() => onSetCandidata(idx, i)}
                    className="accent-amber w-3.5 h-3.5 mt-0.5"
                  />
                  <span className="flex flex-col gap-0.5">
                    <span className="text-xs text-text-primary">
                      {c.cartao_nome} · fatura {formatCompetencia(c.fatura_mes, c.fatura_ano)} ·{' '}
                      {formatBRL(Number(c.total_fatura))}
                    </span>
                    {notasCandidata(c.diferenca, c.valor_bate, c.ja_paga)}
                  </span>
                </label>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-0.5 pl-7">
              <span className="text-xs text-text-primary">
                → {proposta.candidatas[0].cartao_nome} · fatura{' '}
                {formatCompetencia(
                  proposta.candidatas[0].fatura_mes,
                  proposta.candidatas[0].fatura_ano,
                )}{' '}
                · {formatBRL(Number(proposta.candidatas[0].total_fatura))}
              </span>
              {notasCandidata(
                proposta.candidatas[0].diferenca,
                proposta.candidatas[0].valor_bate,
                proposta.candidatas[0].ja_paga,
              )}
            </div>
          ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <WalkBanner rec={reconciliacao} />

      {/* ── Período (o commit o exige como chave de idempotência; o preview
          tolera ausente — aqui o usuário informa as datas) ── */}
      {periodoFaltante && (
        <div className="rounded-md border border-amber/40 bg-amber/5 px-3 py-2.5 flex flex-col gap-2">
          <p className="text-xs text-text-primary">
            ⚠ O extrato não informa o período — preencha para importar.
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            <label className="flex items-center gap-2 text-xs text-text-muted">
              De
              <input
                type="date"
                value={periodoDe}
                onChange={(e) => onSetPeriodo('de', e.target.value)}
                className={dateInputClass}
                aria-label="Início do período"
              />
            </label>
            <label className="flex items-center gap-2 text-xs text-text-muted">
              Até
              <input
                type="date"
                value={periodoAte}
                onChange={(e) => onSetPeriodo('ate', e.target.value)}
                className={dateInputClass}
                aria-label="Fim do período"
              />
            </label>
          </div>
          {/* Só depois que ele MEXE. O flag do preview foi calculado contra o
              período do documento; ao editar a âncora sem poder editar as datas
              checadas, o que estava na tela deixou de valer — e exibir flag
              obsoleto como válido é pior que não exibir nenhum, porque ensina a
              ignorar aviso. Neutro, não âmbar: é ausência de verificação, não
              problema encontrado (o âmbar da caixa já é o "preencha para
              importar"). */}
          {datasNaoReverificadas && (
            <p className="text-[11px] text-text-muted border-t border-amber/20 pt-2">
              Período alterado — as datas das linhas não foram reverificadas contra ele. Se
              alguma linha tinha aviso de data, ele deixou de valer.
            </p>
          )}
        </div>
      )}

      {extrato.linhas.length === 0 && (
        <p className="text-sm text-text-muted py-4 text-center">
          Nenhuma movimentação reconhecida neste extrato.
        </p>
      )}

      {/* A cópia tem de ser mais larga que a palavra "estorno": ela precisa
          cobrir tanto "a loja me devolveu" quanto "meu amigo me pagou de
          volta". Por isso o controle se chama "dinheiro de volta" e as palavras
          bancárias ficam aqui, na explicação. */}
      {secaoLinhas(
        'Receitas',
        receitas,
        categoriasReceita,
        'Recebeu de volta? Marque a linha como dinheiro de volta — ela abate o gasto do ' +
          'mês em vez de entrar como renda. Vale para reembolso, estorno de compra, ' +
          'devolução e dinheiro que alguém te pagou de volta.',
      )}
      {secaoLinhas('Débitos', debitos, categoriasDespesa)}

      {/* ── Pagamentos de fatura ── */}
      {pagamentos.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-text-primary">
            Pagamentos de fatura ({marcadas(pagamentos)}/{pagamentos.length})
          </h2>
          <p className="text-xs text-text-muted">
            Saída de caixa que não é consumo — vira pagamento da fatura confirmada, com o
            valor e a data reais do extrato.
          </p>
          <div className="flex flex-col gap-2">
            {pagamentos.map(({ l, idx, enr }) => cardPagamento(l, idx, enr))}
          </div>
        </div>
      )}

      {/* ── Rendimento do RESUMO (não é linha de movimentação) ── */}
      {rendimento > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-text-primary">Rendimento</h2>
          <label className="flex items-center gap-3 px-3 py-2.5 rounded-md border border-bg-border bg-bg-surface cursor-pointer">
            <input
              type="checkbox"
              checked={importarRendimento}
              onChange={onToggleRendimento}
              className="accent-amber w-4 h-4"
              aria-label="Importar rendimento"
            />
            <span className="text-sm text-text-primary">
              Rendimento <span className="text-success">+{formatBRL(rendimento)}</span> →
              receita “Rendimentos”
            </span>
          </label>
        </div>
      )}

      {/* ── Fallback neutro: baldes que o front não conhece — exibidos, nunca
          importados, selo neutro humanizado (nunca alerta, nunca quebra) ── */}
      {desconhecidas.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-text-muted">Não reconhecidas</h2>
          <p className="text-xs text-text-muted">
            Estas linhas vieram num formato que o app ainda não conhece — não serão importadas.
          </p>
          <div className="flex flex-col gap-2">
            {desconhecidas.map(({ l, idx }) => {
              const selo = neutralBadge(l.balde)
              return (
                <div
                  key={idx}
                  className="rounded-md border border-bg-border bg-bg px-3 py-2.5 flex items-start justify-between gap-2"
                >
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-sm text-text-muted truncate">
                      {l.descricao}
                      <span
                        className={`ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${selo.className}`}
                      >
                        {selo.label}
                      </span>
                    </span>
                    <span className="text-[11px] text-text-muted">{l.data}</span>
                  </div>
                  <span className="text-sm text-text-muted shrink-0">
                    {formatBRL(Number(l.valor))}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  )
}
