import { useMemo, useReducer, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBreakpoint } from '../../hooks/useBreakpoint'
import Button from '../../components/ui/Button'
import { errorDetail } from '../../lib/extractDetail'
import { useCards } from '../../hooks/useCards'
import { useCategories } from '../../hooks/useCategories'
import { useCommitFatura, usePreviewFatura } from '../../hooks/useImportFatura'
import type {
  CompetenciaFatura,
  FaturaCommit,
  FaturaCommitRequest,
  FaturaCommitResponse,
  FaturaPreviewResponse,
  TransacaoCommit,
} from '../../services/importFatura'
import StepUpload from './fatura/StepUpload'
import StepRevisao from './fatura/StepRevisao'
import StepPassadas from './fatura/StepPassadas'
import StepRecibo from './fatura/StepRecibo'
import { isDespesaLinha } from './fatura/helpers'

// ── Estado do wizard (UI-STATE efêmero — vive só nesta rota, fora do TanStack) ──
// useReducer e não Zustand: a fatura + edições não cruzam navegação nem persistem;
// um store global misturaria dado descartável com server-state. RESET = 1 ação.

type Step = 'upload' | 'revisao' | 'passadas' | 'recibo'

interface State {
  step: Step
  cartaoId: number | null
  arquivo: File | null
  uploadError: string
  preview: FaturaPreviewResponse | null
  // edições mapeadas pelo ÍNDICE ORIGINAL em preview.fatura.transacoes
  categorias: Record<number, string>
  apagadas: Record<number, true>
  // só competências controláveis (ja_paga=false); chave "mes-ano"; default true
  passadasPagas: Record<string, boolean>
  commitError: string
  recibo: FaturaCommitResponse | null
}

type Action =
  | { type: 'SET_CARTAO'; id: number | null }
  | { type: 'SET_ARQUIVO'; file: File }
  | { type: 'SET_UPLOAD_ERROR'; msg: string }
  | { type: 'PREVIEW_OK'; preview: FaturaPreviewResponse }
  | { type: 'SET_CATEGORIA'; idx: number; cat: string }
  | { type: 'TOGGLE_APAGAR'; idx: number }
  | { type: 'TOGGLE_PASSADA'; key: string }
  | { type: 'GOTO'; step: Step }
  | { type: 'SET_COMMIT_ERROR'; msg: string }
  | { type: 'COMMIT_OK'; recibo: FaturaCommitResponse }
  | { type: 'RESET' }

const initialState: State = {
  step: 'upload',
  cartaoId: null,
  arquivo: null,
  uploadError: '',
  preview: null,
  categorias: {},
  apagadas: {},
  passadasPagas: {},
  commitError: '',
  recibo: null,
}

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case 'SET_CARTAO':
      return { ...s, cartaoId: a.id, uploadError: '' }
    case 'SET_ARQUIVO':
      return { ...s, arquivo: a.file, uploadError: '' }
    case 'SET_UPLOAD_ERROR':
      return { ...s, uploadError: a.msg }
    case 'PREVIEW_OK': {
      // Faturas passadas nascem MARCADAS como pagas (histórico); as ja_paga não
      // entram no set controlável (aparecem já confirmadas na tela).
      const passadasPagas: Record<string, boolean> = {}
      for (const p of a.preview.faturas_passadas) {
        if (!p.ja_paga) passadasPagas[`${p.mes}-${p.ano}`] = true
      }
      return {
        ...s,
        preview: a.preview,
        step: 'revisao',
        categorias: {},
        apagadas: {},
        passadasPagas,
        commitError: '',
        recibo: null,
      }
    }
    case 'SET_CATEGORIA':
      return { ...s, categorias: { ...s.categorias, [a.idx]: a.cat } }
    case 'TOGGLE_APAGAR': {
      const apagadas = { ...s.apagadas }
      if (apagadas[a.idx]) delete apagadas[a.idx]
      else apagadas[a.idx] = true
      return { ...s, apagadas }
    }
    case 'TOGGLE_PASSADA':
      return {
        ...s,
        passadasPagas: { ...s.passadasPagas, [a.key]: !s.passadasPagas[a.key] },
      }
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

export default function ImportFaturaPage() {
  const isMobile = useBreakpoint('md')
  const navigate = useNavigate()
  const [state, dispatch] = useReducer(reducer, initialState)

  const { data: allCards = [], isLoading: cardsLoading } = useCards()
  // Fatura é de crédito: só cartões ativos que aceitam crédito.
  const eligibleCards = allCards.filter((c) => c.ativo && c.tipo !== 'Débito')
  const { data: categories = [] } = useCategories('despesa')

  const previewMut = usePreviewFatura()
  const commitMut = useCommitFatura()
  const busy = previewMut.isPending || commitMut.isPending

  // Opções do dropdown de categoria: despesas ativas do usuário + garante "Outros"
  // (o default do backend) sempre presente.
  const categoriaOptions = useMemo(() => {
    const uniq = [...new Set(categories.filter((c) => c.ativa).map((c) => c.nome))]
    return uniq.includes('Outros') ? uniq : ['Outros', ...uniq]
  }, [categories])

  const cardNome =
    allCards.find((c) => c.id === state.preview?.cartao_id)?.nome ?? ''

  // ── Preview (chama o Gemini) ──
  function handleExtrair() {
    if (state.cartaoId == null) {
      dispatch({ type: 'SET_UPLOAD_ERROR', msg: 'Escolha um cartão.' })
      return
    }
    if (!state.arquivo) {
      dispatch({ type: 'SET_UPLOAD_ERROR', msg: 'Selecione o PDF da fatura.' })
      return
    }
    dispatch({ type: 'SET_UPLOAD_ERROR', msg: '' })
    previewMut.mutate(
      { cartaoId: state.cartaoId, arquivo: state.arquivo },
      {
        onSuccess: (data) => dispatch({ type: 'PREVIEW_OK', preview: data }),
        onError: (err) =>
          dispatch({
            type: 'SET_UPLOAD_ERROR',
            msg: errorDetail(err, 'Não foi possível ler a fatura. Tente novamente.'),
          }),
      },
    )
  }

  // ── Monta o payload do commit: a fatura INTEIRA de volta (menos linhas apagadas),
  // categoria por linha. As linhas cinzas (pagamento/ajuste/estorno) VIAJAM — o
  // backend as filtra e conta estornos_ignorados/excluidos a partir delas. ──
  function buildPayload(preview: FaturaPreviewResponse): FaturaCommitRequest {
    const transacoes: TransacaoCommit[] = preview.fatura.transacoes
      .map((t, idx) => ({ t, idx }))
      .filter(({ idx }) => !state.apagadas[idx])
      .map(({ t, idx }) => ({
        ...t,
        categoria: isDespesaLinha(t) ? state.categorias[idx] ?? 'Outros' : 'Outros',
      }))
    const fatura: FaturaCommit = { ...preview.fatura, transacoes }
    const competencias_pagas: CompetenciaFatura[] = preview.faturas_passadas
      .filter((p) => !p.ja_paga && state.passadasPagas[`${p.mes}-${p.ano}`])
      .map((p) => ({ mes: p.mes, ano: p.ano }))
    return { cartao_id: preview.cartao_id, fatura, competencias_pagas }
  }

  // ── Commit (SEQUENCIAL — o botão fica isLoading, sem reenvio paralelo) ──
  function handleImportar() {
    if (!state.preview) return
    dispatch({ type: 'SET_COMMIT_ERROR', msg: '' })
    commitMut.mutate(buildPayload(state.preview), {
      onSuccess: (recibo) => dispatch({ type: 'COMMIT_OK', recibo }),
      onError: (err) =>
        dispatch({
          type: 'SET_COMMIT_ERROR',
          msg: errorDetail(err, 'Não foi possível importar a fatura. Tente novamente.'),
        }),
    })
  }

  function goBack() {
    if (busy) return
    if (state.step === 'upload') navigate(-1)
    else if (state.step === 'revisao') dispatch({ type: 'GOTO', step: 'upload' })
    else if (state.step === 'passadas') dispatch({ type: 'GOTO', step: 'revisao' })
    else navigate('/transactions') // recibo
  }

  const title =
    state.step === 'upload'
      ? 'Importar fatura'
      : state.step === 'revisao'
        ? 'Revisar fatura'
        : state.step === 'passadas'
          ? 'Confirmar importação'
          : 'Fatura importada'

  const stepContent: ReactNode = (() => {
    switch (state.step) {
      case 'upload':
        return (
          <StepUpload
            cards={eligibleCards}
            cardsLoading={cardsLoading}
            cartaoId={state.cartaoId}
            onSelectCartao={(id) => dispatch({ type: 'SET_CARTAO', id })}
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
            fatura={state.preview.fatura}
            reconciliacao={state.preview.reconciliacao}
            categorias={state.categorias}
            apagadas={state.apagadas}
            categoriaOptions={categoriaOptions}
            onSetCategoria={(idx, cat) => dispatch({ type: 'SET_CATEGORIA', idx, cat })}
            onToggleApagar={(idx) => dispatch({ type: 'TOGGLE_APAGAR', idx })}
          />
        ) : null
      case 'passadas':
        return state.preview ? (
          <StepPassadas
            passadas={state.preview.faturas_passadas}
            passadasPagas={state.passadasPagas}
            onTogglePassada={(key) => dispatch({ type: 'TOGGLE_PASSADA', key })}
            cardNome={cardNome}
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
              Extrair fatura
            </Button>
          ),
        }
      case 'revisao':
        return {
          primary: (
            <Button onClick={() => dispatch({ type: 'GOTO', step: 'passadas' })}>
              Continuar
            </Button>
          ),
          secondary: (
            <Button variant="ghost" onClick={() => dispatch({ type: 'GOTO', step: 'upload' })}>
              Voltar
            </Button>
          ),
        }
      case 'passadas':
        return {
          primary: (
            <Button onClick={handleImportar} isLoading={commitMut.isPending}>
              Importar fatura
            </Button>
          ),
          secondary: (
            <Button variant="ghost" onClick={() => dispatch({ type: 'GOTO', step: 'revisao' })}>
              Voltar
            </Button>
          ),
        }
      case 'recibo':
        return {
          primary: <Button onClick={() => navigate('/transactions')}>Concluir</Button>,
          secondary: (
            <Button variant="ghost" onClick={() => dispatch({ type: 'RESET' })}>
              Importar outra fatura
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
