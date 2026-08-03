import { useMemo, useReducer, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBreakpoint } from '../../hooks/useBreakpoint'
import Button from '../../components/ui/Button'
import { errorDetail } from '../../lib/extractDetail'
import { useCategories } from '../../hooks/useCategories'
import { useCommitExtrato, usePreviewExtrato } from '../../hooks/useImportExtrato'
import type {
  ExtratoCommitRequest,
  ExtratoCommitResponse,
  ExtratoPreviewResponse,
  LinhaCommit,
} from '../../services/importExtrato'
import StepUpload from './extrato/StepUpload'
import StepRevisao from './extrato/StepRevisao'
import StepRecibo from './extrato/StepRecibo'
import {
  defaultImportar,
  mapEnriquecimento,
  resolverProposta,
  sugerirPeriodo,
} from './extrato/helpers'

// ── Estado do wizard (UI-STATE efêmero — vive só nesta rota, fora do TanStack) ──
// Mesmo racional do ImportFaturaPage: useReducer e não Zustand — o extrato +
// decisões não cruzam navegação nem persistem. RESET = 1 ação. Três passos (o
// extrato não tem "faturas passadas"): upload → revisão → recibo.

type Step = 'upload' | 'revisao' | 'recibo'

interface State {
  step: Step
  arquivo: File | null
  uploadError: string
  preview: ExtratoPreviewResponse | null
  // decisões mapeadas pelo ÍNDICE ORIGINAL em preview.extrato.linhas.
  // `importar` é seedado no PREVIEW_OK (defaultImportar — receita flagada como
  // recorrência nasce DESMARCADA; sem_match/balde desconhecido ficam de fora).
  importar: Record<number, boolean>
  // só EDIÇÕES de categoria; o default por linha é categoria_sugerida ?? 'Outros'
  categorias: Record<number, string>
  // índice escolhido em candidatas (ambíguo); ausente = 0 (a primeira)
  candidataEscolhida: Record<number, number>
  importarRendimento: boolean
  // período digitado quando o extrato não o imprime (o commit o exige)
  periodoDe: string
  periodoAte: string
  // O usuário EDITOU o período. O seed do PREVIEW_OK não conta: `data_suspeita`
  // foi calculado contra a âncora do documento, então mexer nela invalida todo
  // flag da revisão — e o usuário não tem como editar as datas checadas.
  periodoEditado: boolean
  commitError: string
  recibo: ExtratoCommitResponse | null
}

type Action =
  | { type: 'SET_ARQUIVO'; file: File }
  | { type: 'SET_UPLOAD_ERROR'; msg: string }
  | { type: 'PREVIEW_OK'; preview: ExtratoPreviewResponse }
  | { type: 'TOGGLE_IMPORTAR'; idx: number }
  | { type: 'SET_CATEGORIA'; idx: number; cat: string }
  | { type: 'SET_CANDIDATA'; idx: number; i: number }
  | { type: 'TOGGLE_RENDIMENTO' }
  | { type: 'SET_PERIODO'; campo: 'de' | 'ate'; valor: string }
  | { type: 'GOTO'; step: Step }
  | { type: 'SET_COMMIT_ERROR'; msg: string }
  | { type: 'COMMIT_OK'; recibo: ExtratoCommitResponse }
  | { type: 'RESET' }

const initialState: State = {
  step: 'upload',
  arquivo: null,
  uploadError: '',
  preview: null,
  importar: {},
  categorias: {},
  candidataEscolhida: {},
  importarRendimento: true,
  periodoDe: '',
  periodoAte: '',
  periodoEditado: false,
  commitError: '',
  recibo: null,
}

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case 'SET_ARQUIVO':
      return { ...s, arquivo: a.file, uploadError: '' }
    case 'SET_UPLOAD_ERROR':
      return { ...s, uploadError: a.msg }
    case 'PREVIEW_OK': {
      // Seed das decisões — a regra central mora em defaultImportar. Período:
      // quando o extrato não o imprime, sugere a menor/maior data das linhas.
      const enrMap = mapEnriquecimento(a.preview.enriquecimento)
      const importar: Record<number, boolean> = {}
      a.preview.extrato.linhas.forEach((l, idx) => {
        importar[idx] = defaultImportar(l, enrMap.get(idx))
      })
      const periodo = a.preview.extrato.periodo ?? sugerirPeriodo(a.preview)
      return {
        ...s,
        preview: a.preview,
        step: 'revisao',
        importar,
        categorias: {},
        candidataEscolhida: {},
        importarRendimento: true,
        periodoDe: periodo.de,
        periodoAte: periodo.ate,
        // O seed acima é SUGESTÃO, não edição: nada foi invalidado ainda.
        periodoEditado: false,
        commitError: '',
        recibo: null,
      }
    }
    case 'TOGGLE_IMPORTAR':
      return { ...s, importar: { ...s.importar, [a.idx]: !s.importar[a.idx] } }
    case 'SET_CATEGORIA':
      return { ...s, categorias: { ...s.categorias, [a.idx]: a.cat } }
    case 'SET_CANDIDATA':
      return { ...s, candidataEscolhida: { ...s.candidataEscolhida, [a.idx]: a.i } }
    case 'TOGGLE_RENDIMENTO':
      return { ...s, importarRendimento: !s.importarRendimento }
    case 'SET_PERIODO':
      // `periodoEditado` NUNCA volta para false aqui — nem se ele redigitar o
      // valor original. O que ficou obsoleto foi a VERIFICAÇÃO, e ela não
      // rodou de novo; um "voltou ao que era, então vale outra vez" estaria
      // afirmando um check que ninguém fez.
      return a.campo === 'de'
        ? { ...s, periodoDe: a.valor, periodoEditado: true, commitError: '' }
        : { ...s, periodoAte: a.valor, periodoEditado: true, commitError: '' }
    case 'GOTO':
      return { ...s, step: a.step, commitError: '' }
    case 'SET_COMMIT_ERROR':
      return { ...s, commitError: a.msg }
    case 'COMMIT_OK':
      return { ...s, recibo: a.recibo, step: 'recibo', commitError: '' }
    case 'RESET':
      return initialState
  }
}

export default function ImportExtratoPage() {
  const isMobile = useBreakpoint('md')
  const navigate = useNavigate()
  const [state, dispatch] = useReducer(reducer, initialState)

  // Receita e débito têm listas próprias; ambas garantem "Outros" (o default).
  const { data: catsReceita = [] } = useCategories('receita')
  const { data: catsDespesa = [] } = useCategories('despesa')

  const previewMut = usePreviewExtrato()
  const commitMut = useCommitExtrato()
  const busy = previewMut.isPending || commitMut.isPending

  const opcoes = (cats: { nome: string; ativa: boolean }[]) => {
    const uniq = [...new Set(cats.filter((c) => c.ativa).map((c) => c.nome))]
    return uniq.includes('Outros') ? uniq : ['Outros', ...uniq]
  }
  const categoriasReceita = useMemo(() => opcoes(catsReceita), [catsReceita])
  const categoriasDespesa = useMemo(() => opcoes(catsDespesa), [catsDespesa])

  // Join linhas↔enriquecimento por `indice` explícito — nunca por posição.
  const enrMap = useMemo(
    () => mapEnriquecimento(state.preview?.enriquecimento ?? []),
    [state.preview],
  )

  // ── Preview (chama o Gemini) ──
  function handleExtrair() {
    if (!state.arquivo) {
      dispatch({ type: 'SET_UPLOAD_ERROR', msg: 'Selecione o PDF do extrato.' })
      return
    }
    dispatch({ type: 'SET_UPLOAD_ERROR', msg: '' })
    previewMut.mutate(state.arquivo, {
      onSuccess: (data) => dispatch({ type: 'PREVIEW_OK', preview: data }),
      onError: (err) =>
        dispatch({
          type: 'SET_UPLOAD_ERROR',
          msg: errorDetail(err, 'Não foi possível ler o extrato. Tente novamente.'),
        }),
    })
  }

  // ── Monta o payload: o extrato INTEIRO de volta, com `importar` EXPLÍCITO em
  // toda linha (a tela É a decisão — o tri-estado null do backend fica para
  // clientes que não decidem) e cartão+competência confirmados nos pagamentos. ──
  function buildPayload(preview: ExtratoPreviewResponse): ExtratoCommitRequest {
    const linhas: LinhaCommit[] = preview.extrato.linhas.map((l, idx) => {
      const enr = enrMap.get(idx)
      const linha: LinhaCommit = {
        ...l,
        importar: !!state.importar[idx],
        categoria: state.categorias[idx] ?? enr?.categoria_sugerida ?? 'Outros',
      }
      if (l.balde === 'pagamento_fatura' && linha.importar) {
        const proposta = resolverProposta(enr)
        if (proposta.kind === 'confirmavel') {
          const c =
            proposta.candidatas[state.candidataEscolhida[idx] ?? 0] ??
            proposta.candidatas[0]
          linha.cartao_id = c.cartao_id
          linha.fatura_mes = c.fatura_mes
          linha.fatura_ano = c.fatura_ano
        }
      }
      return linha
    })
    const periodo =
      preview.extrato.periodo ?? { de: state.periodoDe, ate: state.periodoAte }
    return {
      extrato: { ...preview.extrato, periodo, linhas },
      importar_rendimento:
        Number(preview.extrato.rendimento) > 0 && state.importarRendimento,
    }
  }

  // ── Commit (SEQUENCIAL — o botão fica isLoading, sem reenvio paralelo).
  // Validação inline, nunca disabled em silêncio. ──
  function handleImportar() {
    if (!state.preview) return
    if (state.preview.extrato.periodo === null) {
      if (!state.periodoDe || !state.periodoAte) {
        dispatch({
          type: 'SET_COMMIT_ERROR',
          msg: 'Informe o período do extrato (de/até) para importar.',
        })
        return
      }
      if (state.periodoDe > state.periodoAte) {
        dispatch({
          type: 'SET_COMMIT_ERROR',
          msg: 'Período inválido: a data inicial é posterior à final.',
        })
        return
      }
    }
    dispatch({ type: 'SET_COMMIT_ERROR', msg: '' })
    commitMut.mutate(buildPayload(state.preview), {
      onSuccess: (recibo) => dispatch({ type: 'COMMIT_OK', recibo }),
      onError: (err) =>
        dispatch({
          type: 'SET_COMMIT_ERROR',
          msg: errorDetail(err, 'Não foi possível importar o extrato. Tente novamente.'),
        }),
    })
  }

  function goBack() {
    if (busy) return
    if (state.step === 'upload') navigate(-1)
    else if (state.step === 'revisao') dispatch({ type: 'GOTO', step: 'upload' })
    else navigate('/transactions') // recibo
  }

  const title =
    state.step === 'upload'
      ? 'Importar extrato'
      : state.step === 'revisao'
        ? 'Revisar extrato'
        : 'Extrato importado'

  const stepContent: ReactNode = (() => {
    switch (state.step) {
      case 'upload':
        return (
          <StepUpload
            arquivo={state.arquivo}
            onSelectArquivo={(file) => dispatch({ type: 'SET_ARQUIVO', file })}
            onArquivoInvalido={() =>
              dispatch({ type: 'SET_UPLOAD_ERROR', msg: 'Selecione um arquivo .pdf.' })
            }
            isPreviewing={previewMut.isPending}
            error={state.uploadError}
          />
        )
      case 'revisao':
        return state.preview ? (
          <StepRevisao
            isMobile={isMobile}
            extrato={state.preview.extrato}
            reconciliacao={state.preview.reconciliacao}
            enriquecimento={enrMap}
            importar={state.importar}
            categorias={state.categorias}
            candidataEscolhida={state.candidataEscolhida}
            categoriasReceita={categoriasReceita}
            categoriasDespesa={categoriasDespesa}
            importarRendimento={state.importarRendimento}
            periodoFaltante={state.preview.extrato.periodo === null}
            periodoDe={state.periodoDe}
            periodoAte={state.periodoAte}
            datasNaoReverificadas={state.periodoEditado}
            onToggleImportar={(idx) => dispatch({ type: 'TOGGLE_IMPORTAR', idx })}
            onSetCategoria={(idx, cat) => dispatch({ type: 'SET_CATEGORIA', idx, cat })}
            onSetCandidata={(idx, i) => dispatch({ type: 'SET_CANDIDATA', idx, i })}
            onToggleRendimento={() => dispatch({ type: 'TOGGLE_RENDIMENTO' })}
            onSetPeriodo={(campo, valor) => dispatch({ type: 'SET_PERIODO', campo, valor })}
            error={state.commitError}
          />
        ) : null
      case 'recibo':
        return state.recibo ? <StepRecibo recibo={state.recibo} /> : null
    }
  })()

  // Rodapé: primário sempre clicável (validação inline, nunca disabled em silêncio).
  const footer: { primary: ReactNode; secondary?: ReactNode } = (() => {
    switch (state.step) {
      case 'upload':
        return {
          primary: (
            <Button onClick={handleExtrair} isLoading={previewMut.isPending}>
              Extrair extrato
            </Button>
          ),
        }
      case 'revisao':
        return {
          primary: (
            <Button onClick={handleImportar} isLoading={commitMut.isPending}>
              Importar extrato
            </Button>
          ),
          secondary: (
            <Button variant="ghost" onClick={() => dispatch({ type: 'GOTO', step: 'upload' })}>
              Voltar
            </Button>
          ),
        }
      case 'recibo':
        return {
          primary: <Button onClick={() => navigate('/transactions')}>Concluir</Button>,
          secondary: (
            <Button variant="ghost" onClick={() => dispatch({ type: 'RESET' })}>
              Importar outro extrato
            </Button>
          ),
        }
    }
  })()

  // ── Mobile ──
  if (isMobile) {
    return (
      <div className="flex flex-col h-full">
        <header className="shrink-0 flex items-center gap-3 px-4 h-14 border-b border-bg-border bg-bg-surface">
          <button
            onClick={goBack}
            disabled={busy}
            className="text-text-muted hover:text-text-primary text-lg leading-none disabled:opacity-40 transition-colors"
            aria-label="Voltar"
          >
            ←
          </button>
          <h1 className="text-sm font-medium text-text-primary">{title}</h1>
        </header>
        <main className="flex-1 overflow-y-auto p-4">{stepContent}</main>
        <footer className="shrink-0 px-4 py-3 border-t border-bg-border bg-bg-surface flex flex-col gap-2">
          {footer.primary}
          {footer.secondary}
        </footer>
      </div>
    )
  }

  // ── Desktop ──
  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={goBack}
          disabled={busy}
          className="text-text-muted hover:text-text-primary text-lg leading-none disabled:opacity-40 transition-colors"
          aria-label="Voltar"
        >
          ←
        </button>
        <h1 className="text-[22px] font-medium tracking-tight text-text-primary">{title}</h1>
      </div>

      {stepContent}

      <div className="flex gap-3 mt-6">
        {footer.secondary}
        {footer.primary}
      </div>
    </div>
  )
}
