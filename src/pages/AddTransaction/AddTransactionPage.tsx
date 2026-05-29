import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { z } from 'zod'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import { useBreakpoint } from '../../hooks/useBreakpoint'
import { useCards } from '../../hooks/useCards'
import { useCategories } from '../../hooks/useCategories'
import { useMonthlyStats } from '../../hooks/useStatistics'
import { useCreateTransaction } from '../../hooks/useTransactions'
import { suggestCategory } from '../../services/ai'
import type { Category } from '../../services/categories'

// ─── constants ────────────────────────────────────────────────────────────────

const FORMAS_PAGAMENTO = ['Débito', 'Crédito', 'PIX', 'Dinheiro', 'TED/DOC']

const selectClass =
  'w-full px-3 py-3 rounded-sm text-sm text-text-primary bg-bg-surface border border-bg-border focus:outline-none focus:border-amber transition-colors'

const formatBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

// ─── schema ───────────────────────────────────────────────────────────────────

const schema = z
  .object({
    tipo: z.enum(['receita', 'despesa']),
    valor: z.coerce
      .number({ invalid_type_error: 'Valor inválido' })
      .positive('Deve ser maior que zero'),
    descricao: z.string().min(1, 'Campo obrigatório'),
    categoria: z.string().min(1, 'Selecione uma categoria'),
    data: z.string().min(1, 'Campo obrigatório'),
    forma_pagamento: z.string().min(1, 'Campo obrigatório'),
    cartao_id: z.number().nullable().optional(),
    parcelado: z.boolean(),
    num_parcelas: z.preprocess(
      (v) => (v === '' || v === undefined || v === null ? undefined : Number(v)),
      z.number().int().min(2, 'Mínimo 2 parcelas').max(24, 'Máximo 24 parcelas').optional(),
    ),
  })
  .refine((d) => !d.parcelado || (d.num_parcelas != null && d.num_parcelas >= 2), {
    message: 'Informe o número de parcelas',
    path: ['num_parcelas'],
  })

type FormData = z.infer<typeof schema>

// ─── useDebounce ──────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

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
          key={cat.id}
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
}: ImpactPreviewProps) {
  const isReceita = tipo === 'receita'
  const catObj = allCategories.find((c) => c.nome === categoria)
  const valorPorParcela =
    parcelado && numParcelas && numParcelas >= 2 && valor > 0
      ? valor / numParcelas
      : null
  const saldoEstimado =
    saldoAtual != null && valor > 0
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

  const [suggestedCategory, setSuggestedCategory] = useState<string | null>(null)

  const categories = allCategories.filter((c) => c.ativa)
  const creditCards = allCards.filter((c) => c.tipo === 'credito' || c.tipo === 'ambos')
  const hasCards = creditCards.length > 0

  const today = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-')

  const {
    control,
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isValid },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
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
      num_parcelas: undefined,
    },
  })

  const watched = watch()
  const { forma_pagamento, parcelado, tipo, descricao } = watched
  const valorNum = Number(watched.valor) || 0
  const numParcelas = watched.num_parcelas ? Number(watched.num_parcelas) : undefined

  const isCredito = forma_pagamento === 'Crédito'
  const showCartao = isCredito
  const showParcelamento = isCredito && hasCards && watched.cartao_id != null
  const valorPorParcela =
    parcelado && numParcelas && numParcelas >= 2 && valorNum > 0
      ? valorNum / numParcelas
      : null

  // canSubmit adds the no-cards guard on top of RHF isValid
  const canSubmit =
    isValid &&
    !createTx.isPending &&
    (!isCredito || !hasCards || watched.cartao_id != null)

  // AI suggestion via debounced description
  const debouncedDescricao = useDebounce(descricao, 500)
  useEffect(() => {
    if (!debouncedDescricao || debouncedDescricao.length < 3 || !categories.length) {
      setSuggestedCategory(null)
      return
    }
    suggestCategory(
      debouncedDescricao,
      categories.map((c) => c.nome),
    ).then(setSuggestedCategory)
  }, [debouncedDescricao]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reset cartao + parcelamento when switching away from Crédito
  useEffect(() => {
    if (!isCredito) {
      setValue('cartao_id', null, { shouldValidate: false })
      setValue('parcelado', false, { shouldValidate: false })
      setValue('num_parcelas', undefined, { shouldValidate: false })
    }
  }, [isCredito]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reset num_parcelas when parcelamento is toggled off
  useEffect(() => {
    if (!parcelado) {
      setValue('num_parcelas', undefined, { shouldValidate: false })
    }
  }, [parcelado]) // eslint-disable-line react-hooks/exhaustive-deps

  const buildPayload = (data: FormData) => ({
    tipo: data.tipo,
    valor: Number(data.valor).toFixed(2),
    descricao: data.descricao,
    categoria: data.categoria,
    data: data.data,
    forma_pagamento: data.forma_pagamento,
    cartao_id: data.cartao_id ?? null,
    parcelado: data.parcelado,
    ...(data.parcelado && data.num_parcelas
      ? { num_parcelas: Number(data.num_parcelas) }
      : {}),
  })

  const onSave = handleSubmit(async (data) => {
    await createTx.mutateAsync(buildPayload(data))
    navigate('/dashboard')
  })

  const onSaveAndAdd = handleSubmit(async (data) => {
    await createTx.mutateAsync(buildPayload(data))
    reset({
      tipo: data.tipo,
      valor: '' as unknown as number,
      descricao: '',
      categoria: '',
      data: data.data,
      forma_pagamento: data.forma_pagamento,
      cartao_id: null,
      parcelado: false,
      num_parcelas: undefined,
    })
    setSuggestedCategory(null)
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
        {...register('descricao')}
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
                categories={categories}
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

      {/* Data */}
      <Input
        label="Data"
        type="date"
        error={errors.data?.message}
        {...register('data')}
      />

      {/* Forma de pagamento */}
      <Controller
        name="forma_pagamento"
        control={control}
        render={({ field }) => (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-text-muted">Forma de pagamento</label>
            <div className="flex flex-wrap gap-2">
              {FORMAS_PAGAMENTO.map((f) => (
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
                  onChange={(e) =>
                    field.onChange(e.target.value ? Number(e.target.value) : null)
                  }
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
                    'relative w-10 h-6 rounded-full transition-colors',
                    field.value ? 'bg-amber' : 'bg-bg-border',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform',
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
                error={errors.num_parcelas?.message}
                {...register('num_parcelas')}
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
            isLoading={createTx.isPending}
            disabled={!canSubmit}
          >
            Salvar e adicionar outro
          </Button>
          <Button onClick={onSave} isLoading={createTx.isPending} disabled={!canSubmit}>
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
                isLoading={createTx.isPending}
                disabled={!canSubmit}
              >
                Salvar e adicionar outro
              </Button>
              <Button onClick={onSave} isLoading={createTx.isPending} disabled={!canSubmit}>
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
          />
        </div>
      </div>
    </div>
  )
}
