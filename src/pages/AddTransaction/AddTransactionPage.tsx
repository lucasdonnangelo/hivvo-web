import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useRef, useState } from 'react'
import { Controller, useForm, type Resolver } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { z } from 'zod'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import { useBreakpoint } from '../../hooks/useBreakpoint'
import { useCards } from '../../hooks/useCards'
import { useCategories } from '../../hooks/useCategories'
import { useMonthlyStats } from '../../hooks/useStatistics'
import { useCreateTransaction } from '../../hooks/useTransactions'
import { useCreateRecorrencia } from '../../hooks/useRecorrencias'
import { suggestCategory } from '../../services/ai'
import type { Category } from '../../services/categories'
import type { RecorrenciaCreate } from '../../services/recorrencias'
import { useUIStore } from '../../store/uiStore'

// ─── constants ────────────────────────────────────────────────────────────────

const FORMAS_PAGAMENTO = ['Débito', 'Crédito', 'PIX', 'Dinheiro', 'TED/DOC']

const selectClass =
  'w-full px-3 py-3 rounded-sm text-sm text-text-primary bg-bg-surface border border-bg-border focus:outline-none focus:border-amber transition-colors'

const formatBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

// Mês de início DEFAULT pela regra do dia (espelha o backend Fase 3a): se o dia
// da ocorrência ainda não passou neste mês → mês corrente; senão → mês seguinte
// (com virada de ano). Fica editável na UI (o "ajustar").
function defaultInicio(dia: number, h: Date): [number, number] {
  const m = h.getMonth() + 1
  const y = h.getFullYear()
  if (dia >= h.getDate()) return [m, y]
  if (m === 12) return [1, y + 1]
  return [m + 1, y]
}

const toMonthStr = (mes: number, ano: number) =>
  `${ano}-${String(mes).padStart(2, '0')}`

// "YYYY-MM" → "MM/YYYY" para exibição.
const formatMesAno = (s: string) => {
  const [y, m] = s.split('-')
  return `${m}/${y}`
}

// Mensagem de erro do backend (FastAPI): string, array de erros (usa .msg) ou
// objeto; cai no genérico quando não há detail (rede, 500 sem corpo). Espelha o
// helper do SettingsPage/RegisterPage (FE-15: extrair p/ util compartilhado).
function extractDetail(detail: unknown): string {
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0]
    if (first && typeof first === 'object' && 'msg' in first) {
      return String((first as { msg: unknown }).msg)
    }
    return String(first)
  }
  if (detail && typeof detail === 'object') return JSON.stringify(detail)
  return 'Erro ao salvar. Verifique os dados e tente novamente.'
}

// ─── schema ───────────────────────────────────────────────────────────────────

const schema = z
  .object({
    tipo: z.enum(['receita', 'despesa']),
    valor: z.coerce
      .number()
      .refine(v => !isNaN(v), { message: 'Valor inválido' })
      .refine(v => v > 0, { message: 'Deve ser maior que zero' }),
    descricao: z.string().min(1, 'Campo obrigatório'),
    categoria: z.string().min(1, 'Selecione uma categoria'),
    data: z.string().min(1, 'Campo obrigatório'),
    forma_pagamento: z.string().min(1, 'Campo obrigatório'),
    cartao_id: z.number().nullable().optional(),
    parcelado: z.boolean(),
    total_parcelas: z.preprocess(
      (v) => (v === '' || v === undefined || v === null ? undefined : Number(v)),
      z.number().int().min(2, 'Mínimo 2 parcelas').max(24, 'Máximo 24 parcelas').optional(),
    ),
    // Recorrência (modo alternativo — troca os campos avulsos).
    recorrente: z.boolean(),
    dia_do_mes: z.preprocess(
      (v) => (v === '' || v === undefined || v === null ? undefined : Number(v)),
      z.number().int().min(1, 'Dia entre 1 e 31').max(31, 'Dia entre 1 e 31').optional(),
    ),
    mes_inicio_str: z.string().optional(),
  })
  .refine((d) => !d.parcelado || (d.total_parcelas != null && d.total_parcelas >= 2), {
    message: 'Informe o número de parcelas',
    path: ['total_parcelas'],
  })
  .refine((d) => !d.recorrente || (d.dia_do_mes != null && d.dia_do_mes >= 1 && d.dia_do_mes <= 31), {
    message: 'Informe o dia do mês',
    path: ['dia_do_mes'],
  })
  .refine((d) => !d.recorrente || /^\d{4}-\d{2}$/.test(d.mes_inicio_str ?? ''), {
    message: 'Informe o mês de início',
    path: ['mes_inicio_str'],
  })

type FormData = z.infer<typeof schema>

// ─── CategoryGrid ─────────────────────────────────────────────────────────────

interface CategoryGridProps {
  categories: Category[]
  selected: string
  suggested: string | null
  onSelect: (nome: string) => void
}

function CategoryGrid({ categories, selected, suggested, onSelect }: CategoryGridProps) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {categories.map((cat) => (
        <button
          key={cat.is_padrao ? `padrao:${cat.tipo}:${cat.nome}` : cat.id}
          type="button"
          onClick={() => onSelect(cat.nome)}
          className={[
            'flex flex-col items-center gap-1 py-2.5 px-1 rounded-lg border transition-colors',
            selected === cat.nome
              ? 'border-amber bg-amber/10'
              : 'border-bg-border bg-bg-surface hover:border-amber/40',
          ].join(' ')}
        >
          <span className="text-xl leading-none">{cat.icone}</span>
          <span
            className={[
              'text-[11px] text-center leading-tight line-clamp-1',
              selected === cat.nome ? 'text-amber' : 'text-text-primary',
            ].join(' ')}
          >
            {cat.nome}
          </span>
          {suggested === cat.nome && (
            <span className="text-[9px] text-amber leading-none">✦ IA</span>
          )}
        </button>
      ))}
    </div>
  )
}

// ─── ImpactPreview (desktop only) ─────────────────────────────────────────────

interface ImpactPreviewProps {
  tipo: 'receita' | 'despesa'
  valor: number
  descricao: string
  categoria: string
  parcelado: boolean
  numParcelas: number | undefined
  saldoAtual: number | undefined
  allCategories: Category[]
  recorrente: boolean
  diaDoMes: number | undefined
  mesInicioStr: string | undefined
}

function ImpactPreview({
  tipo,
  valor,
  descricao,
  categoria,
  parcelado,
  numParcelas,
  saldoAtual,
  allCategories,
  recorrente,
  diaDoMes,
  mesInicioStr,
}: ImpactPreviewProps) {
  const isReceita = tipo === 'receita'
  const catObj = allCategories.find((c) => c.nome === categoria)
  // Parcela e "saldo após" não se aplicam à recorrência (ela se repete todo mês).
  const valorPorParcela =
    !recorrente && parcelado && numParcelas && numParcelas >= 2 && valor > 0
      ? valor / numParcelas
      : null
  const saldoEstimado =
    !recorrente && saldoAtual != null && valor > 0
      ? saldoAtual + (isReceita ? valor : -valor)
      : null

  return (
    <div className="bg-bg-surface rounded-lg p-6 flex flex-col gap-5 sticky top-6 self-start">
      <h2 className="text-sm font-medium text-text-primary">Preview</h2>

      <span
        className={[
          'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium self-start',
          isReceita ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger',
        ].join(' ')}
      >
        {isReceita ? '↑' : '↓'} {isReceita ? 'Receita' : 'Despesa'}
      </span>

      <div>
        <p className="text-xs text-text-muted mb-1">Valor</p>
        <p
          className={[
            'text-2xl font-medium',
            isReceita ? 'text-success' : 'text-danger',
          ].join(' ')}
        >
          {valor > 0
            ? `${isReceita ? '+' : '−'}${formatBRL(valor)}`
            : <span className="text-text-muted text-lg">—</span>}
        </p>
        {valorPorParcela && (
          <p className="text-xs text-text-muted mt-1">
            {formatBRL(valorPorParcela)} × {numParcelas}x
          </p>
        )}
        {recorrente && diaDoMes ? (
          <p className="text-xs text-text-muted mt-1">
            Todo dia {diaDoMes}
            {mesInicioStr ? ` · começa ${formatMesAno(mesInicioStr)}` : ''}
          </p>
        ) : null}
      </div>

      {descricao ? (
        <div>
          <p className="text-xs text-text-muted mb-1">Descrição</p>
          <p className="text-sm text-text-primary truncate">{descricao}</p>
        </div>
      ) : null}

      {catObj ? (
        <div>
          <p className="text-xs text-text-muted mb-1">Categoria</p>
          <p className="text-sm text-text-primary flex items-center gap-2">
            <span>{catObj.icone}</span>
            <span>{catObj.nome}</span>
          </p>
        </div>
      ) : null}

      {saldoEstimado != null && valor > 0 ? (
        <div className="pt-4 border-t border-bg-border">
          <p className="text-xs text-text-muted mb-1">Saldo estimado após transação</p>
          <p
            className={[
              'text-base font-medium',
              saldoEstimado > 0
                ? 'text-success'
                : saldoEstimado < 0
                  ? 'text-danger'
                  : 'text-text-primary',
            ].join(' ')}
          >
            {formatBRL(saldoEstimado)}
          </p>
          <p className="text-xs text-text-muted mt-0.5">Atual: {formatBRL(saldoAtual!)}</p>
        </div>
      ) : null}
    </div>
  )
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function AddTransactionPage() {
  const isMobile = useBreakpoint('md')
  const navigate = useNavigate()
  const now = new Date()

  const { data: allCategories = [] } = useCategories()
  const { data: allCards = [] } = useCards()
  const { data: stats } = useMonthlyStats(now.getMonth() + 1, now.getFullYear())
  const createTx = useCreateTransaction()
  const createRec = useCreateRecorrencia()

  const addToast = useUIStore((s) => s.addToast)
  const [suggestedCategory, setSuggestedCategory] = useState<string | null>(null)

  const categories = allCategories.filter((c) => c.ativa)
  const creditCards = allCards.filter((c) => c.tipo === 'Crédito' || c.tipo === 'Ambos')
  const hasCards = creditCards.length > 0

  const today = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-')

  // Defaults do modo recorrente: dia = hoje; "começa em" = mês default pela regra.
  const diaHoje = now.getDate()
  const defaultInicioStr = (() => {
    const [m, a] = defaultInicio(diaHoje, now)
    return toMonthStr(m, a)
  })()
  // "Começa em" pré-preenchido pela regra do dia (defaultInicioStr) e livremente
  // editável (NÃO empurramos o mês automaticamente — decisão de produto: o app
  // não troca a escolha do usuário; quem protege contra ocorrência no passado é
  // o aviso).

  // `min` do input — barreira do MÊS no seletor (bloqueia meses passados).
  const minMesInicio = toMonthStr(now.getMonth() + 1, now.getFullYear())
  // Hoje à meia-noite (sem hora) — base ÚNICA de comparação da 1ª ocorrência.
  const hoje0 = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  // A 1ª ocorrência (mês/ano do "Começa em" + dia_do_mes, com clamp de mês curto
  // espelhando o backend) está no passado? `<` estrito — == hoje é válido, coerente
  // com o backend. Checagem de UX (feedback antes do submit); a VERDADE é o backend.
  const primeiraOcorrenciaNoPassado = (
    mesInicioStr: string | undefined,
    diaDoMes: number | string | undefined,
  ): boolean => {
    const dia = Number(diaDoMes)
    if (!mesInicioStr || !/^\d{4}-\d{2}$/.test(mesInicioStr) || !dia) return false
    const [ano, mes] = mesInicioStr.split('-').map(Number)
    const ultimoDia = new Date(ano, mes, 0).getDate() // dia 0 do mês seguinte = último deste
    const diaClamp = Math.min(dia, ultimoDia)
    return new Date(ano, mes - 1, diaClamp) < hoje0
  }
  // Mensagem do aviso/toast — nomeia o dia e o mês da ocorrência que já passou.
  const mensagemOcorrenciaPassada = (
    diaDoMes: number | string | undefined,
    mesInicioStr: string | undefined,
  ): string => {
    const dia = Number(diaDoMes)
    const [ano, mes] = (mesInicioStr ?? '').split('-').map(Number)
    const mesNome =
      Number.isFinite(ano) && Number.isFinite(mes)
        ? new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(new Date(ano, mes - 1, 1))
        : ''
    return `A primeira ocorrência (dia ${dia} de ${mesNome}) já passou. Escolha um dia futuro ou comece no próximo mês.`
  }
  // Aviso inline mostrado após o blur do "Começa em" / mudança do dia (feedback antes do submit).
  const [inicioInvalido, setInicioInvalido] = useState(false)

  const {
    control,
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    clearErrors,
    getValues,
    reset,
    formState: { errors },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema) as Resolver<z.infer<typeof schema>>,
    mode: 'onChange',
    defaultValues: {
      tipo: 'despesa',
      valor: '' as unknown as number,
      descricao: '',
      categoria: '',
      data: today,
      forma_pagamento: 'PIX',
      cartao_id: null,
      parcelado: false,
      total_parcelas: undefined,
      recorrente: false,
      dia_do_mes: diaHoje,
      mes_inicio_str: defaultInicioStr,
    },
  })

  const watched = watch()
  const { forma_pagamento, parcelado, tipo, recorrente } = watched
  // Grid de seleção filtrado pelo tipo corrente (client-side, sem refetch).
  // A tela de Gerenciar categorias (Settings) mostra todas — só o grid filtra.
  const visibleCategories = categories.filter((c) => c.tipo === tipo)
  const valorNum = Number(watched.valor) || 0
  const numParcelas = watched.total_parcelas ? Number(watched.total_parcelas) : undefined

  const isCredito = forma_pagamento === 'Crédito'
  // Cartão/parcelamento só no modo avulso — recorrência não passa por cartão (§3.4).
  const showCartao = isCredito && !recorrente
  const showParcelamento = isCredito && !recorrente && hasCards && watched.cartao_id != null
  const valorPorParcela =
    parcelado && numParcelas && numParcelas >= 2 && valorNum > 0
      ? valorNum / numParcelas
      : null
  // Recorrência nunca é no crédito → oculta "Crédito" da lista nesse modo.
  const formasDisponiveis = recorrente
    ? FORMAS_PAGAMENTO.filter((f) => f !== 'Crédito')
    : FORMAS_PAGAMENTO

  const busy = createTx.isPending || createRec.isPending

  // O botão Salvar NUNCA fica disabled em silêncio: só trava durante o request
  // (`busy`). A validação roda no clique (handleSubmit) e mostra o que falta em
  // cada campo — inclusive a exigência de cartão no crédito (checada no submit
  // via setError, não como disabled). Assim o usuário sempre sabe o que resolver.

  // Sugestão de categoria por IA: dispara apenas no BLUR da descrição (FE-08 —
  // o endpoint dedicado é stateless, mas a chamada continua custando Gemini).
  // suggestSeq descarta respostas obsoletas (FE-19): só a do último disparo vale.
  const suggestSeq = useRef(0)
  const handleSuggestCategory = () => {
    const desc = getValues('descricao').trim()
    if (!desc) return
    const seq = ++suggestSeq.current
    const valorAtual = Number(getValues('valor')) || undefined
    suggestCategory(desc, getValues('tipo'), valorAtual).then((cat) => {
      if (seq !== suggestSeq.current || !cat) return
      // Só marca/aplica a sugestão quando ela DE FATO entra no estado: (1) o
      // usuário ainda não escolheu (escolha manual nunca é sobrescrita) e (2) a
      // categoria existe no grid do tipo corrente. Assim o selo "✦ IA" nunca
      // pinta uma categoria que não está selecionada nem seleciona algo fora do
      // grid visível — destaque e estado ficam sempre sincronizados.
      const tipoAtual = getValues('tipo')
      const existeNoTipo = categories.some((c) => c.tipo === tipoAtual && c.nome === cat)
      if (!getValues('categoria') && existeNoTipo) {
        setValue('categoria', cat, { shouldValidate: true })
        setSuggestedCategory(cat)
      }
    })
  }
  const descricaoField = register('descricao')
  const inicioField = register('mes_inicio_str')
  const diaField = register('dia_do_mes')

  // Reset cartao + parcelamento when switching away from Crédito
  useEffect(() => {
    if (!isCredito) {
      setValue('cartao_id', null, { shouldValidate: false })
      setValue('parcelado', false, { shouldValidate: false })
      setValue('total_parcelas', undefined, { shouldValidate: false })
    }
  }, [isCredito]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reset total_parcelas when parcelamento is toggled off
  useEffect(() => {
    if (!parcelado) {
      setValue('total_parcelas', undefined, { shouldValidate: false })
    }
  }, [parcelado]) // eslint-disable-line react-hooks/exhaustive-deps

  // Recorrente é mutuamente exclusivo com parcelamento/cartão: ligar limpa esses
  // campos e derruba "Crédito" da forma. Desligar reabilita o prefill de início.
  useEffect(() => {
    if (recorrente) {
      setValue('parcelado', false, { shouldValidate: false })
      setValue('cartao_id', null, { shouldValidate: false })
      setValue('total_parcelas', undefined, { shouldValidate: false })
      if (getValues('forma_pagamento') === 'Crédito') {
        setValue('forma_pagamento', 'PIX', { shouldValidate: true })
      }
    } else {
      setInicioInvalido(false)
    }
  }, [recorrente]) // eslint-disable-line react-hooks/exhaustive-deps

  const buildPayload = (data: FormData) => ({
    tipo: data.tipo,
    valor: parseFloat(String(data.valor).replace(',', '.')).toFixed(2),
    descricao: data.descricao,
    categoria: data.categoria,
    data: data.data,
    forma_pagamento: data.forma_pagamento,
    cartao_id: data.cartao_id ?? null,
    parcelado: data.parcelado,
    ...(data.parcelado && data.total_parcelas
      ? { total_parcelas: Number(data.total_parcelas) }
      : {}),
  })

  const buildRecorrenciaPayload = (data: FormData): RecorrenciaCreate => {
    const [ys, ms] = (data.mes_inicio_str ?? '').split('-')
    return {
      tipo: data.tipo,
      valor: parseFloat(String(data.valor).replace(',', '.')).toFixed(2),
      categoria: data.categoria,
      forma_pagamento: data.forma_pagamento,
      dia_do_mes: Number(data.dia_do_mes),
      descricao: data.descricao,
      // Enviamos sempre o início do campo (o que o usuário vê é o que vai) — faz
      // o "ajustar" valer, mesmo quando coincide com o default do backend.
      mes_inicio: Number(ms),
      ano_inicio: Number(ys),
    }
  }

  // Crédito com cartões cadastrados exige escolher um cartão. Não é regra do Zod
  // (depende de `hasCards`, dado de runtime) — é validada no submit e vira erro
  // VISÍVEL no campo, nunca uma trava silenciosa do botão.
  const cartaoObrigatorioNaoEscolhido = (data: FormData) =>
    !data.recorrente && data.forma_pagamento === 'Crédito' && hasCards && data.cartao_id == null

  const onSave = handleSubmit(async (data) => {
    if (data.recorrente) {
      // Recompute fresco (item 4): aviso exibido e bloqueio usam o MESMO cálculo.
      const passado = primeiraOcorrenciaNoPassado(data.mes_inicio_str, data.dia_do_mes)
      setInicioInvalido(passado)
      if (passado) {
        addToast({
          message: mensagemOcorrenciaPassada(data.dia_do_mes, data.mes_inicio_str),
          type: 'error',
        })
        return
      }
    }
    if (cartaoObrigatorioNaoEscolhido(data)) {
      setError('cartao_id', { type: 'manual', message: 'Selecione um cartão' })
      return
    }
    try {
      if (data.recorrente) {
        await createRec.mutateAsync(buildRecorrenciaPayload(data))
      } else {
        await createTx.mutateAsync(buildPayload(data))
      }
      navigate('/dashboard')
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: unknown } } })
        ?.response?.data?.detail
      addToast({ message: extractDetail(detail), type: 'error' })
    }
  })

  const onSaveAndAdd = handleSubmit(async (data) => {
    if (data.recorrente) {
      const passado = primeiraOcorrenciaNoPassado(data.mes_inicio_str, data.dia_do_mes)
      setInicioInvalido(passado)
      if (passado) {
        addToast({
          message: mensagemOcorrenciaPassada(data.dia_do_mes, data.mes_inicio_str),
          type: 'error',
        })
        return
      }
    }
    if (cartaoObrigatorioNaoEscolhido(data)) {
      setError('cartao_id', { type: 'manual', message: 'Selecione um cartão' })
      return
    }
    try {
      if (data.recorrente) {
        await createRec.mutateAsync(buildRecorrenciaPayload(data))
      } else {
        await createTx.mutateAsync(buildPayload(data))
      }
      setInicioInvalido(false)
      reset({
        tipo: data.tipo,
        valor: '' as unknown as number,
        descricao: '',
        categoria: '',
        data: data.data,
        forma_pagamento: data.forma_pagamento,
        cartao_id: null,
        parcelado: false,
        total_parcelas: undefined,
        recorrente: data.recorrente,
        dia_do_mes: diaHoje,
        mes_inicio_str: defaultInicioStr,
      })
      suggestSeq.current++ // descarta sugestão em voo do form anterior
      setSuggestedCategory(null)
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: unknown } } })
        ?.response?.data?.detail
      addToast({ message: extractDetail(detail), type: 'error' })
    }
  })

  // ── shared form fields ────────────────────────────────────────────────────

  const formFields = (
    <div className="flex flex-col gap-5">

      {/* Tipo */}
      <Controller
        name="tipo"
        control={control}
        render={({ field }) => (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-text-muted">Tipo</label>
            <div className="flex gap-2">
              {(['despesa', 'receita'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => field.onChange(t)}
                  className={[
                    'flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors',
                    field.value === t
                      ? t === 'despesa'
                        ? 'bg-danger/10 border-danger text-danger'
                        : 'bg-success/10 border-success text-success'
                      : 'bg-bg-surface border-bg-border text-text-muted hover:border-text-muted',
                  ].join(' ')}
                >
                  {t === 'despesa' ? '↓ Despesa' : '↑ Receita'}
                </button>
              ))}
            </div>
          </div>
        )}
      />

      {/* Recorrente — modo alternativo (troca os campos avulsos) */}
      <Controller
        name="recorrente"
        control={control}
        render={({ field }) => (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-primary">Recorrente</span>
              <button
                type="button"
                role="switch"
                aria-checked={field.value}
                onClick={() => field.onChange(!field.value)}
                className={[
                  'relative w-10 h-6 rounded-full overflow-hidden transition-colors',
                  field.value ? 'bg-amber' : 'bg-bg-border',
                ].join(' ')}
              >
                <span
                  className={[
                    'absolute top-0.5 left-0 w-5 h-5 bg-white rounded-full transition-transform',
                    field.value ? 'translate-x-[18px]' : 'translate-x-0.5',
                  ].join(' ')}
                />
              </button>
            </div>
            {field.value && (
              <p className="text-xs text-text-muted">
                Um lançamento que se repete todo mês.
              </p>
            )}
          </div>
        )}
      />

      {/* Valor */}
      <Input
        label="Valor (R$)"
        type="number"
        step="0.01"
        min="0.01"
        placeholder="0,00"
        error={errors.valor?.message}
        {...register('valor')}
      />

      {/* Descrição */}
      <Input
        label="Descrição"
        placeholder="Ex: Mercado, Salário..."
        error={errors.descricao?.message}
        {...descricaoField}
        onBlur={(e) => {
          void descricaoField.onBlur(e)
          handleSuggestCategory()
        }}
      />

      {/* Categoria */}
      <Controller
        name="categoria"
        control={control}
        render={({ field }) => (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-text-muted">Categoria</label>
            {categories.length === 0 ? (
              <div className="h-16 bg-bg-surface rounded-lg animate-pulse" />
            ) : (
              <CategoryGrid
                categories={visibleCategories}
                selected={field.value}
                suggested={suggestedCategory}
                onSelect={(nome) => field.onChange(nome)}
              />
            )}
            {errors.categoria && (
              <p className="text-xs text-danger">{errors.categoria.message}</p>
            )}
          </div>
        )}
      />

      {/* Data — só no modo avulso (recorrência não tem data única) */}
      {!recorrente && (
        <Input
          label="Data"
          type="date"
          error={errors.data?.message}
          {...register('data')}
        />
      )}

      {/* Recorrência: dia do mês + mês de início */}
      {recorrente && (
        <>
          <Input
            label="Dia do mês"
            type="number"
            min="1"
            max="31"
            placeholder="Ex: 5"
            error={errors.dia_do_mes?.message}
            {...diaField}
            onChange={(e) => {
              void diaField.onChange(e)
              // O dia também define a 1ª ocorrência → reavalia o aviso ao mudar.
              setInicioInvalido(
                primeiraOcorrenciaNoPassado(getValues('mes_inicio_str'), e.target.value),
              )
            }}
          />
          <Input
            label="Começa em"
            type="month"
            min={minMesInicio}
            error={
              errors.mes_inicio_str?.message ??
              (inicioInvalido
                ? mensagemOcorrenciaPassada(watched.dia_do_mes, watched.mes_inicio_str)
                : undefined)
            }
            {...inicioField}
            onChange={(e) => {
              void inicioField.onChange(e)
              // Some assim que a 1ª ocorrência volta a ser válida (não brigar com a digitação).
              if (
                inicioInvalido &&
                !primeiraOcorrenciaNoPassado(e.target.value, getValues('dia_do_mes'))
              ) {
                setInicioInvalido(false)
              }
            }}
            onBlur={(e) => {
              void inicioField.onBlur(e)
              setInicioInvalido(primeiraOcorrenciaNoPassado(e.target.value, getValues('dia_do_mes')))
            }}
          />
        </>
      )}

      {/* Forma de pagamento */}
      <Controller
        name="forma_pagamento"
        control={control}
        render={({ field }) => (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-text-muted">Forma de pagamento</label>
            <div className="flex flex-wrap gap-2">
              {formasDisponiveis.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => field.onChange(f)}
                  className={[
                    'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                    field.value === f
                      ? 'bg-amber border-amber text-bg'
                      : 'bg-bg-surface border-bg-border text-text-muted hover:border-amber/50',
                  ].join(' ')}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        )}
      />

      {/* Cartão */}
      {showCartao && (
        <Controller
          name="cartao_id"
          control={control}
          render={({ field }) => (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-text-muted">Cartão</label>
              {!hasCards ? (
                <p className="text-xs text-text-muted bg-bg-surface rounded-lg px-3 py-3 border border-bg-border">
                  Nenhum cartão cadastrado. Adicione um na aba{' '}
                  <span className="text-text-primary font-medium">Cartões</span>.
                </p>
              ) : (
                <select
                  value={field.value ?? ''}
                  onChange={(e) => {
                    const v = e.target.value ? Number(e.target.value) : null
                    field.onChange(v)
                    if (v != null) clearErrors('cartao_id')
                  }}
                  className={selectClass}
                >
                  <option value="">Selecione um cartão</option>
                  {creditCards.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              )}
              {errors.cartao_id && (
                <p className="text-xs text-danger">{errors.cartao_id.message}</p>
              )}
            </div>
          )}
        />
      )}

      {/* Parcelamento */}
      {showParcelamento && (
        <>
          <Controller
            name="parcelado"
            control={control}
            render={({ field }) => (
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-primary">Parcelar compra</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={field.value}
                  onClick={() => field.onChange(!field.value)}
                  className={[
                    'relative w-10 h-6 rounded-full overflow-hidden transition-colors',
                    field.value ? 'bg-amber' : 'bg-bg-border',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'absolute top-0.5 left-0 w-5 h-5 bg-white rounded-full transition-transform',
                      field.value ? 'translate-x-[18px]' : 'translate-x-0.5',
                    ].join(' ')}
                  />
                </button>
              </div>
            )}
          />

          {parcelado && (
            <div className="flex flex-col gap-1.5">
              <Input
                label="Número de parcelas"
                type="number"
                min="2"
                max="24"
                placeholder="Ex: 12"
                error={errors.total_parcelas?.message}
                {...register('total_parcelas')}
              />
              {valorPorParcela && (
                <p className="text-xs text-text-muted">
                  {formatBRL(valorPorParcela)} por parcela
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )

  // ── mobile layout ─────────────────────────────────────────────────────────

  if (isMobile) {
    return (
      <div className="flex flex-col h-full">
        <div className="shrink-0 px-4 py-3 border-b border-bg-border flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="text-text-muted hover:text-text-primary transition-colors text-lg leading-none"
            aria-label="Voltar"
          >
            ‹
          </button>
          <h1 className="text-base font-medium text-text-primary">Adicionar transação</h1>
        </div>

        <div className="flex-1 overflow-y-auto p-4">{formFields}</div>

        <div className="shrink-0 px-4 py-4 border-t border-bg-border flex flex-col gap-2 bg-bg">
          <Button
            variant="ghost"
            onClick={onSaveAndAdd}
            isLoading={busy}
            disabled={busy}
          >
            Salvar e adicionar outro
          </Button>
          <Button onClick={onSave} isLoading={busy} disabled={busy}>
            Salvar
          </Button>
        </div>
      </div>
    )
  }

  // ── desktop layout ────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      <header className="shrink-0 px-6 py-4 border-b border-bg-border">
        <h1 className="text-lg font-medium text-text-primary">Adicionar transação</h1>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-[1fr_300px] gap-6 max-w-4xl">
          <div className="flex flex-col gap-6">
            {formFields}
            <div className="flex gap-3">
              <Button
                variant="ghost"
                onClick={onSaveAndAdd}
                isLoading={busy}
                disabled={busy}
              >
                Salvar e adicionar outro
              </Button>
              <Button onClick={onSave} isLoading={busy} disabled={busy}>
                Salvar
              </Button>
            </div>
          </div>

          <ImpactPreview
            tipo={tipo}
            valor={valorNum}
            descricao={watched.descricao}
            categoria={watched.categoria}
            parcelado={parcelado}
            numParcelas={numParcelas}
            saldoAtual={stats?.saldo != null ? Number(stats.saldo) : undefined}
            allCategories={categories}
            recorrente={recorrente}
            diaDoMes={watched.dia_do_mes ? Number(watched.dia_do_mes) : undefined}
            mesInicioStr={watched.mes_inicio_str}
          />
        </div>
      </div>
    </div>
  )
}
