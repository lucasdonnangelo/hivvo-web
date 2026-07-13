import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from 'react-router-dom'
import { useBreakpoint } from '../../hooks/useBreakpoint'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import NewCategoryModal from '../../components/categories/NewCategoryModal'
import { useCategories, useDeleteCategory } from '../../hooks/useCategories'
import {
  useRecorrencias,
  useUpdateRecorrencia,
  useDeleteRecorrencia,
  useDeleteRecorrenciaPermanente,
  useCorrigirValorRecorrencia,
  useRecorrenciaDetail,
} from '../../hooks/useRecorrencias'
import type { Category } from '../../services/categories'
import type { Recorrencia, RecorrenciaUpdate } from '../../services/recorrencias'
import { useAuthStore } from '../../store/authStore'
import { useUIStore } from '../../store/uiStore'
import { updateMe, changePassword, logout } from '../../services/auth'
import { getAllTransactions } from '../../services/transactions'
import { clearHistorico } from '../../services/ai'

const pwSchema = z
  .object({
    senha_atual: z.string().min(1, 'Obrigatório.'),
    nova_senha: z.string().min(8, 'Mínimo 8 caracteres.'),
    confirmar: z.string(),
  })
  .refine((d) => d.nova_senha === d.confirmar, {
    message: 'As senhas não coincidem.',
    path: ['confirmar'],
  })

type PwForm = z.infer<typeof pwSchema>

// Recorrência não passa por cartão (§3.4) → sem "Crédito".
const FORMAS_RECORRENCIA = ['Débito', 'PIX', 'Dinheiro', 'TED/DOC']

const formatBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

const MONTHS_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

const recFieldClass =
  'w-full rounded-md bg-bg border border-bg-border px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-amber transition-colors'

function extractDetail(detail: unknown): string {
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0]
    if (first && typeof first === 'object' && 'msg' in first) {
      return String((first as { msg: unknown }).msg)
    }
    return String(first)
  }
  if (detail && typeof detail === 'object') {
    return JSON.stringify(detail)
  }
  return 'Erro ao salvar. Tente novamente.'
}

function downloadJSON(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-medium text-text-muted uppercase tracking-wider">{title}</h2>
      <div className="rounded-lg bg-bg-surface border border-bg-border divide-y divide-bg-border">
        {children}
      </div>
    </section>
  )
}

function SettingsRow({ children }: { children: React.ReactNode }) {
  return <div className="px-4 py-4">{children}</div>
}

export default function SettingsPage() {
  const isMobile = useBreakpoint('md')
  const navigate = useNavigate()

  // ── Auth store ────────────────────────────────────────────────────────────
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const addToast = useUIStore((s) => s.addToast)

  // ── Nome ──────────────────────────────────────────────────────────────────
  const [name, setName] = useState(user?.username ?? '')
  const [nameError, setNameError] = useState('')
  const [nameSaving, setNameSaving] = useState(false)
  const [nameSuccess, setNameSuccess] = useState(false)

  async function handleSaveName() {
    const trimmed = name.trim()
    if (trimmed.length < 2) {
      setNameError('Mínimo 2 caracteres.')
      return
    }
    setNameSaving(true)
    setNameError('')
    setNameSuccess(false)
    try {
      const updated = await updateMe(trimmed)
      setUser(updated)
      setNameSuccess(true)
      setTimeout(() => setNameSuccess(false), 2000)
      addToast({ message: 'Perfil atualizado', type: 'success' })
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: unknown } } })
        ?.response?.data?.detail
      setNameError(extractDetail(detail))
      addToast({ message: 'Erro ao salvar nome. Tente novamente.', type: 'error' })
    } finally {
      setNameSaving(false)
    }
  }

  // ── Senha ─────────────────────────────────────────────────────────────────
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset: resetPwForm,
    setError: setPwError,
  } = useForm<PwForm>({ resolver: zodResolver(pwSchema) })

  const [pwSuccess, setPwSuccess] = useState(false)

  async function onPasswordSubmit(data: PwForm) {
    setPwSuccess(false)
    try {
      await changePassword(data.senha_atual, data.nova_senha)
      resetPwForm()
      setPwSuccess(true)
      setTimeout(() => setPwSuccess(false), 3000)
      addToast({ message: 'Senha alterada com sucesso', type: 'success' })
    } catch {
      setPwError('senha_atual', { message: 'Senha atual incorreta.' })
      addToast({ message: 'Erro ao alterar senha. Verifique os dados e tente novamente.', type: 'error' })
    }
  }

  // ── Logout ────────────────────────────────────────────────────────────────
  const [logoutModalOpen, setLogoutModalOpen] = useState(false)

  async function handleLogout() {
    try {
      await logout()
    } catch {}
    clearAuth()
    navigate('/login', { replace: true })
  }

  // ── Resetar Assistente ────────────────────────────────────────────────────
  const [resetModalOpen, setResetModalOpen] = useState(false)
  const [isResetting, setIsResetting] = useState(false)

  async function handleResetAssistant() {
    setIsResetting(true)
    try {
      await clearHistorico()
      setResetModalOpen(false)
      addToast({ message: 'Assistente resetado com sucesso', type: 'success' })
    } catch {
      addToast({ message: 'Erro ao resetar o Assistente. Tente novamente.', type: 'error' })
    } finally {
      setIsResetting(false)
    }
  }

  // ── Backup ────────────────────────────────────────────────────────────────
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState('')

  async function handleExport() {
    setIsExporting(true)
    setExportError('')
    try {
      const data = await getAllTransactions()
      const date = new Date().toISOString().slice(0, 10)
      downloadJSON(data, `hivvo-backup-${date}.json`)
    } catch {
      setExportError('Não foi possível exportar. Tente novamente.')
    } finally {
      setIsExporting(false)
    }
  }

  // ── Categorias ────────────────────────────────────────────────────────────
  const { data: categories = [], isLoading: catsLoading } = useCategories()
  const deleteMutation = useDeleteCategory()

  // Qual tipo o modal "Nova categoria" está criando (a SEÇÃO define o tipo — sem
  // dropdown). null = fechado.
  const [addTipo, setAddTipo] = useState<'receita' | 'despesa' | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  // ── Recorrências ──────────────────────────────────────────────────────────
  const { data: recorrencias = [], isLoading: recsLoading } = useRecorrencias()
  const updateRecMutation = useUpdateRecorrencia()
  const deleteRecMutation = useDeleteRecorrencia()
  const corrigirRecMutation = useCorrigirValorRecorrencia()
  const hardDeleteRecMutation = useDeleteRecorrenciaPermanente()

  const [editingRec, setEditingRec] = useState<Recorrencia | null>(null)
  const [recDescricao, setRecDescricao] = useState('')
  const [recValor, setRecValor] = useState('')
  const [recCategoria, setRecCategoria] = useState('')
  const [recDia, setRecDia] = useState('')
  const [recForma, setRecForma] = useState('')
  const [recError, setRecError] = useState('')
  const [deletingRecId, setDeletingRecId] = useState<string | null>(null)
  // Intenção ao mudar o valor (§3.1.2): "alterar" (versionado) vs "corrigir" (erro).
  const [recValorIntent, setRecValorIntent] = useState<'alterar' | 'corrigir'>('alterar')
  // Confirmação do apagar permanentemente (troca o conteúdo do modal de editar).
  const [confirmingHardDelete, setConfirmingHardDelete] = useState(false)

  // Detalhe do rec em edição: precisamos de vigencias.length p/ gating do corrigir.
  const { data: editingDetail } = useRecorrenciaDetail(editingRec?.id ?? null)
  const vigenciasCount = editingDetail?.vigencias.length

  function openEditRec(rec: Recorrencia) {
    setEditingRec(rec)
    setRecDescricao(rec.descricao)
    setRecValor(rec.valor_exibicao ?? '')
    setRecCategoria(rec.categoria)
    setRecDia(String(rec.dia_do_mes))
    setRecForma(rec.forma_pagamento)
    setRecError('')
    setRecValorIntent('alterar')
    setConfirmingHardDelete(false)
  }

  function closeEditRec() {
    setEditingRec(null)
    setConfirmingHardDelete(false)
  }

  // Valor exibido/carregado no campo (o mesmo do prefill) para comparar com o
  // editado. Base = valor_exibicao: p/ início futuro é a vigência futura, então
  // digitar o mesmo valor NÃO conta como mudança (evita versionar à toa).
  const recValorAtual =
    editingRec?.valor_exibicao != null ? Number(editingRec.valor_exibicao) : null
  const recValorNovo = recValor.trim() ? parseFloat(recValor.replace(',', '.')) : NaN
  // Envia valor quando: mudou de um valor conhecido, OU não havia base
  // (só encerrada — o backend substitui in place, sem versionar).
  const recValorChanged =
    !isNaN(recValorNovo) &&
    (recValorAtual == null || recValorNovo.toFixed(2) !== recValorAtual.toFixed(2))
  // "Corrigir valor" só com vigência única (erro fresco — §3.1.2).
  const podeCorrigir = vigenciasCount === 1
  // Metadados mudaram? (para decidir se, no fluxo "corrigir", também vai um PATCH normal)
  const recMetadadosChanged = editingRec
    ? recDescricao.trim() !== editingRec.descricao ||
      recCategoria !== editingRec.categoria ||
      Number(recDia) !== editingRec.dia_do_mes ||
      recForma !== editingRec.forma_pagamento
    : false

  const recSaving = updateRecMutation.isPending || corrigirRecMutation.isPending

  async function handleSaveRec() {
    if (!editingRec) return
    const desc = recDescricao.trim()
    if (desc.length < 2) {
      setRecError('Descrição: mínimo 2 caracteres.')
      return
    }
    const dia = Number(recDia)
    if (!Number.isInteger(dia) || dia < 1 || dia > 31) {
      setRecError('Dia do mês entre 1 e 31.')
      return
    }
    if (isNaN(recValorNovo) || recValorNovo <= 0) {
      setRecError('Valor deve ser maior que zero.')
      return
    }
    const metaPayload: RecorrenciaUpdate = {
      descricao: desc,
      categoria: recCategoria,
      dia_do_mes: dia,
      forma_pagamento: recForma,
    }

    // Intenção "corrigir" (§3.1.2 — foi erro): reescreve o valor em TODOS os meses.
    // Corrigir PRIMEIRO (é o passo que pode 409): se falhar, nada foi escrito —
    // sem estado parcial nem toast de sucesso competindo. Metadados (se mudaram)
    // vão depois, via PATCH normal.
    if (recValorChanged && recValorIntent === 'corrigir' && podeCorrigir) {
      try {
        await corrigirRecMutation.mutateAsync({ id: editingRec.id, valor: recValorNovo.toFixed(2) })
        if (recMetadadosChanged) {
          await updateRecMutation.mutateAsync({ id: editingRec.id, payload: metaPayload })
        }
        closeEditRec()
      } catch (err: unknown) {
        // 409 (múltiplas vigências) ou outro erro → mensagem explícita de que o
        // valor não foi corrigido, seguida do detalhe do backend (quando houver).
        const detail = (err as { response?: { data?: { detail?: unknown } } })
          ?.response?.data?.detail
        const backend =
          typeof detail === 'string' && detail.trim() ? ` ${detail}` : ''
        addToast({ message: `O valor não foi corrigido.${backend}`, type: 'error' })
      }
      return
    }

    // Intenção normal "alterar" (versionado) + metadados num único PATCH.
    // Metadados retroativos (backend usa exclude_unset); valor só quando muda.
    const payload: RecorrenciaUpdate = { ...metaPayload }
    if (recValorChanged) payload.valor = recValorNovo.toFixed(2)
    updateRecMutation.mutate(
      { id: editingRec.id, payload },
      {
        onSuccess: () => closeEditRec(),
        onError: () => setRecError('Erro ao salvar. Tente novamente.'),
      },
    )
  }

  function handleHardDeleteRec() {
    if (!editingRec) return
    hardDeleteRecMutation.mutate(editingRec.id, {
      onSuccess: () => closeEditRec(),
      onError: () => addToast({ message: 'Erro ao apagar. Tente novamente.', type: 'error' }),
    })
  }

  // Lista de categorias de um tipo (skeleton / vazio / itens com confirmação de
  // remoção). Só custom têm id → só elas mostram o ✕ (padrão vem sem).
  function renderCategoryList(tipo: Category['tipo']) {
    const cats = categories.filter((c) => c.tipo === tipo)
    if (catsLoading) {
      return (
        <div className="flex flex-col gap-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-9 rounded-md bg-bg-border animate-pulse" />
          ))}
        </div>
      )
    }
    if (cats.length === 0) {
      return (
        <div className="flex flex-col items-center gap-2 py-4 text-center">
          <p className="text-sm text-text-muted">Nenhuma categoria disponível.</p>
        </div>
      )
    }
    return (
      <div className="flex flex-col gap-1">
        {cats.map((cat) =>
          deletingId !== null && deletingId === cat.id ? (
            <div
              key={cat.is_padrao ? `padrao:${cat.tipo}:${cat.nome}` : cat.id}
              className="flex items-center justify-between gap-2 px-2 py-2 rounded-md bg-danger/5 border border-danger/30"
            >
              <span className="text-xs text-text-primary truncate">
                Remover <span className="font-medium">{cat.nome}</span>?
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setDeletingId(null)}
                  className="text-xs text-text-muted hover:text-text-primary transition-colors"
                >
                  Não
                </button>
                <button
                  onClick={() => {
                    // só categorias custom têm id (padrão = null e sem ✕)
                    if (cat.id == null) return
                    deleteMutation.mutate(cat.id, {
                      onSuccess: () => setDeletingId(null),
                    })
                  }}
                  disabled={deleteMutation.isPending}
                  className="text-xs text-danger hover:text-danger/80 font-medium transition-colors disabled:opacity-50"
                >
                  {deleteMutation.isPending ? '…' : 'Sim'}
                </button>
              </div>
            </div>
          ) : (
            <div
              key={cat.is_padrao ? `padrao:${cat.tipo}:${cat.nome}` : cat.id}
              className="flex items-center justify-between gap-2 px-2 py-2 rounded-md hover:bg-bg-border/50 transition-colors group"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-base leading-none">{cat.icone}</span>
                <span className="text-sm text-text-primary truncate">{cat.nome}</span>
              </div>
              {!cat.is_padrao && (
                <button
                  onClick={() => setDeletingId(cat.id)}
                  className="text-text-muted hover:text-danger transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 text-xs shrink-0"
                  aria-label={`Remover ${cat.nome}`}
                >
                  ✕
                </button>
              )}
            </div>
          ),
        )}
      </div>
    )
  }

  // ── Content ───────────────────────────────────────────────────────────────

  const content = (
    <div className="flex flex-col gap-6">

      {/* ── Perfil ── */}
      <Section title="Perfil">

        {/* Nome */}
        <SettingsRow>
          <p className="text-xs text-text-muted mb-2">Nome</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                if (nameError) setNameError('')
                if (nameSuccess) setNameSuccess(false)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveName()
              }}
              className={`flex-1 min-w-0 rounded-md bg-bg border px-3 py-2.5 text-sm text-text-primary outline-none focus:border-amber transition-colors ${
                nameError ? 'border-danger' : 'border-bg-border'
              }`}
            />
            <button
              onClick={handleSaveName}
              disabled={nameSaving}
              className={`shrink-0 px-4 py-2.5 rounded-md text-sm font-medium transition-colors disabled:opacity-50 ${
                nameSuccess
                  ? 'bg-success/10 text-success border border-success/30'
                  : 'bg-amber text-bg hover:bg-amber-light active:bg-amber-dark'
              }`}
            >
              {nameSaving ? '…' : nameSuccess ? '✓ Salvo' : 'Salvar'}
            </button>
          </div>
          {nameError && <p className="mt-1 text-xs text-danger">{nameError}</p>}
        </SettingsRow>

        {/* Email */}
        <SettingsRow>
          <p className="text-xs text-text-muted mb-2">Email</p>
          <input
            type="email"
            value={user?.email ?? ''}
            readOnly
            disabled
            className="w-full rounded-md bg-bg-border/50 border border-bg-border px-3 py-2.5 text-sm text-text-muted cursor-not-allowed"
          />
        </SettingsRow>

        {/* Alterar senha */}
        <SettingsRow>
          <p className="text-sm font-medium text-text-primary mb-3">Alterar senha</p>
          <form
            onSubmit={handleSubmit(onPasswordSubmit)}
            className="flex flex-col gap-3"
            noValidate
          >
            <Input
              id="senha_atual"
              label="Senha atual"
              type="password"
              autoComplete="current-password"
              showToggle
              error={errors.senha_atual?.message}
              {...register('senha_atual')}
            />
            <Input
              id="nova_senha"
              label="Nova senha"
              type="password"
              autoComplete="new-password"
              showToggle
              error={errors.nova_senha?.message}
              {...register('nova_senha')}
            />
            <Input
              id="confirmar"
              label="Confirmar nova senha"
              type="password"
              autoComplete="new-password"
              showToggle
              error={errors.confirmar?.message}
              {...register('confirmar')}
            />
            {pwSuccess && (
              <p className="text-xs text-success">Senha alterada com sucesso.</p>
            )}
            <Button type="submit" isLoading={isSubmitting}>
              Salvar senha
            </Button>
          </form>
        </SettingsRow>

        {/* Logout */}
        <SettingsRow>
          <button
            onClick={() => setLogoutModalOpen(true)}
            className="w-full flex items-center justify-center px-4 py-3 rounded-md text-sm font-medium border border-bg-border text-danger hover:bg-danger/5 active:bg-danger/10 transition-colors duration-150"
          >
            Sair da conta
          </button>
        </SettingsRow>

      </Section>

      {/* ── Categorias (separadas por tipo — cada seção cria o seu tipo) ── */}
      {(['despesa', 'receita'] as const).map((secTipo) => (
        <Section
          key={secTipo}
          title={secTipo === 'despesa' ? 'Categorias de despesa' : 'Categorias de receita'}
        >
          <SettingsRow>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-text-muted">
                {secTipo === 'despesa'
                  ? 'Categorias dos seus gastos.'
                  : 'Categorias dos seus ganhos.'}
              </p>
              <button
                onClick={() => setAddTipo(secTipo)}
                className="text-xs text-amber hover:text-amber-light transition-colors font-medium"
              >
                + Adicionar
              </button>
            </div>
            {renderCategoryList(secTipo)}
          </SettingsRow>
        </Section>
      ))}

      {/* ── Recorrências ── */}
      <Section title="Recorrências">
        <SettingsRow>
          <p className="text-sm text-text-muted mb-3">
            Receitas e despesas que se repetem todo mês.
          </p>

          {recsLoading ? (
            <div className="flex flex-col gap-2">
              {[0, 1].map((i) => (
                <div key={i} className="h-11 rounded-md bg-bg-border animate-pulse" />
              ))}
            </div>
          ) : recorrencias.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-4 text-center">
              <p className="text-sm text-text-muted">
                Nenhuma recorrência cadastrada. Crie uma ao adicionar um lançamento recorrente.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {recorrencias.map((rec) =>
                deletingRecId === rec.id ? (
                  <div
                    key={rec.id}
                    className="flex flex-col gap-2 px-3 py-2.5 rounded-md bg-danger/5 border border-danger/30"
                  >
                    <p className="text-xs text-text-primary">
                      Encerrar <span className="font-medium">{rec.descricao}</span>?
                    </p>
                    <p className="text-xs text-text-muted">
                      Encerrar mantém o histórico e para de gerar a partir deste mês. Se esta recorrência foi criada por engano e você quer removê-la completamente (inclusive do passado), use Editar → Apagar permanentemente.
                    </p>
                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={() => setDeletingRecId(null)}
                        className="text-xs text-text-muted hover:text-text-primary transition-colors"
                      >
                        Não
                      </button>
                      <button
                        onClick={() =>
                          deleteRecMutation.mutate(rec.id, {
                            onSuccess: () => setDeletingRecId(null),
                          })
                        }
                        disabled={deleteRecMutation.isPending}
                        className="text-xs text-danger hover:text-danger/80 font-medium transition-colors disabled:opacity-50"
                      >
                        {deleteRecMutation.isPending ? '…' : 'Sim, encerrar'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    key={rec.id}
                    className="flex items-center justify-between gap-2 px-2 py-2 rounded-md hover:bg-bg-border/50 transition-colors group"
                  >
                    <button
                      onClick={() => openEditRec(rec)}
                      className="flex flex-col min-w-0 text-left flex-1"
                    >
                      <span className="text-sm text-text-primary truncate">
                        {rec.descricao} ·{' '}
                        <span className={rec.tipo === 'receita' ? 'text-success' : 'text-danger'}>
                          {rec.valor_exibicao != null
                            ? rec.mes_exibicao != null && rec.ano_exibicao != null
                              ? `${formatBRL(Number(rec.valor_exibicao))}/mês · a partir de ${MONTHS_SHORT[rec.mes_exibicao - 1]}/${rec.ano_exibicao}`
                              : `${formatBRL(Number(rec.valor_exibicao))}/mês`
                            : '—'}
                        </span>
                      </span>
                      <span className="text-xs text-text-muted">
                        {rec.tipo === 'receita' ? 'Receita' : 'Despesa'} · todo dia {rec.dia_do_mes}
                      </span>
                    </button>
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => openEditRec(rec)}
                        className="w-7 h-7 flex items-center justify-center rounded text-text-muted hover:text-text-primary hover:bg-bg-border transition-colors text-sm"
                        aria-label={`Editar ${rec.descricao}`}
                      >
                        ✎
                      </button>
                      <button
                        onClick={() => setDeletingRecId(rec.id)}
                        className="w-7 h-7 flex items-center justify-center rounded text-text-muted hover:text-danger hover:bg-bg-border transition-colors text-xs"
                        aria-label={`Encerrar ${rec.descricao}`}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ),
              )}
            </div>
          )}
        </SettingsRow>
      </Section>

      {/* ── Importar dados ── */}
      <Section title="Importar dados">
        <SettingsRow>
          <p className="text-sm text-text-muted mb-3">
            Importe transações a partir de um arquivo CSV.
          </p>
          <Button variant="ghost" onClick={() => navigate('/import')}>
            ↑ Importar CSV
          </Button>
        </SettingsRow>
      </Section>

      {/* ── Exportar dados ── */}
      <Section title="Exportar dados">
        <SettingsRow>
          <p className="text-sm text-text-muted mb-3">
            Baixar um arquivo JSON com todas as suas transações.
          </p>
          <Button variant="ghost" isLoading={isExporting} onClick={handleExport}>
            {isExporting ? 'Exportando…' : '↓ Exportar JSON'}
          </Button>
          {exportError && (
            <p className="mt-2 text-xs text-danger">{exportError}</p>
          )}
        </SettingsRow>
      </Section>

      {/* ── Assistente IA ── */}
      <Section title="Assistente IA">
        <SettingsRow>
          <p className="text-sm text-text-muted mb-3">
            Apaga todo o histórico de conversas com o Assistente. Na próxima conversa, a IA não terá memória das interações anteriores e se apresentará como se fosse o primeiro acesso.
          </p>
          <Button variant="danger" onClick={() => setResetModalOpen(true)}>
            Resetar Assistente
          </Button>
        </SettingsRow>
      </Section>

      {/* ── Legal ── */}
      <Section title="Legal">
        <SettingsRow>
          <button
            onClick={() => navigate('/terms')}
            className="w-full flex items-center justify-between text-sm text-text-primary hover:text-amber transition-colors"
          >
            <span>Termos de Uso</span>
            <span className="text-text-muted">→</span>
          </button>
        </SettingsRow>
        <SettingsRow>
          <button
            onClick={() => navigate('/privacy')}
            className="w-full flex items-center justify-between text-sm text-text-primary hover:text-amber transition-colors"
          >
            <span>Política de Privacidade</span>
            <span className="text-text-muted">→</span>
          </button>
        </SettingsRow>
      </Section>

    </div>
  )

  const addModal = addTipo && (
    <NewCategoryModal
      tipo={addTipo}
      existingNames={categories
        .filter((c) => c.tipo === addTipo)
        .map((c) => c.nome)}
      onClose={() => setAddTipo(null)}
    />
  )

  const editRecModal = editingRec && (() => {
    const catNames = categories
      .filter((c) => c.ativa && c.tipo === editingRec.tipo)
      .map((c) => c.nome)
    const catOptions = catNames.includes(recCategoria) ? catNames : [recCategoria, ...catNames]
    const formaOptions = FORMAS_RECORRENCIA.includes(recForma)
      ? FORMAS_RECORRENCIA
      : [recForma, ...FORMAS_RECORRENCIA]

    // ── Confirmação do apagar permanentemente (troca o conteúdo do modal) ──
    if (confirmingHardDelete) {
      return (
        <Modal
          title="Apagar permanentemente?"
          onClose={closeEditRec}
          footer={
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setConfirmingHardDelete(false)}>
                Cancelar
              </Button>
              <Button
                variant="danger"
                isLoading={hardDeleteRecMutation.isPending}
                onClick={handleHardDeleteRec}
              >
                Apagar permanentemente
              </Button>
            </div>
          }
        >
          <p className="text-sm text-text-muted leading-relaxed">
            Isto remove a recorrência e todo o histórico dela, inclusive de meses passados. Use apenas se foi criada por engano. Esta ação não pode ser desfeita.
          </p>
        </Modal>
      )
    }

    return (
      <Modal
        title="Editar recorrência"
        onClose={closeEditRec}
        footer={
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => setConfirmingHardDelete(true)}
              className="text-xs text-danger hover:text-danger/80 transition-colors"
            >
              Apagar permanentemente
            </button>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={closeEditRec}>
                Cancelar
              </Button>
              <Button isLoading={recSaving} onClick={handleSaveRec}>
                Salvar
              </Button>
            </div>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-text-muted" htmlFor="rec-descricao">Descrição</label>
            <input
              id="rec-descricao"
              type="text"
              value={recDescricao}
              onChange={(e) => {
                setRecDescricao(e.target.value)
                if (recError) setRecError('')
              }}
              className={recFieldClass}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-text-muted" htmlFor="rec-valor">Valor (R$)</label>
            <input
              id="rec-valor"
              type="number"
              step="0.01"
              min="0.01"
              value={recValor}
              onChange={(e) => {
                setRecValor(e.target.value)
                if (recError) setRecError('')
              }}
              className={recFieldClass}
            />
            {recValorChanged && (
              <div className="flex flex-col gap-1.5 mt-0.5">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={recValorIntent === 'alterar'}
                    onChange={() => setRecValorIntent('alterar')}
                    className="accent-amber mt-0.5"
                  />
                  <span className="flex flex-col">
                    <span className="text-xs text-text-primary">Alterar valor</span>
                    <span className="text-xs text-text-muted">
                      A partir deste mês. Os meses anteriores mantêm o valor anterior.
                    </span>
                  </span>
                </label>
                {podeCorrigir && (
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={recValorIntent === 'corrigir'}
                      onChange={() => setRecValorIntent('corrigir')}
                      className="accent-amber mt-0.5"
                    />
                    <span className="flex flex-col">
                      <span className="text-xs text-text-primary">Corrigir valor</span>
                      <span className="text-xs text-text-muted">
                        Foi erro de digitação. Aplica a todos os meses, inclusive passados.
                      </span>
                    </span>
                  </label>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-text-muted" htmlFor="rec-categoria">Categoria</label>
            <select
              id="rec-categoria"
              value={recCategoria}
              onChange={(e) => setRecCategoria(e.target.value)}
              className={recFieldClass}
            >
              {catOptions.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-text-muted" htmlFor="rec-dia">Dia do mês</label>
            <input
              id="rec-dia"
              type="number"
              min="1"
              max="31"
              value={recDia}
              onChange={(e) => {
                setRecDia(e.target.value)
                if (recError) setRecError('')
              }}
              className={recFieldClass}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-text-muted" htmlFor="rec-forma">Forma de pagamento</label>
            <select
              id="rec-forma"
              value={recForma}
              onChange={(e) => setRecForma(e.target.value)}
              className={recFieldClass}
            >
              {formaOptions.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>

          {recError && <p className="text-xs text-danger">{recError}</p>}
        </div>
      </Modal>
    )
  })()

  const resetModal = resetModalOpen && (
    <Modal
      title="Resetar Assistente?"
      onClose={() => setResetModalOpen(false)}
      footer={
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setResetModalOpen(false)}>
            Cancelar
          </Button>
          <Button variant="danger" isLoading={isResetting} onClick={handleResetAssistant}>
            Resetar
          </Button>
        </div>
      }
    >
      <p className="text-sm text-text-muted leading-relaxed">
        Esta ação apagará todo o histórico de conversas com a IA. Ela não terá mais memória das suas interações anteriores. Esta ação é irreversível.
      </p>
    </Modal>
  )

  const logoutModal = logoutModalOpen && (
    <Modal
      title="Sair da conta"
      onClose={() => setLogoutModalOpen(false)}
      footer={
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setLogoutModalOpen(false)}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={handleLogout}>
            Sair
          </Button>
        </div>
      }
    >
      <p className="text-sm text-text-muted leading-relaxed">
        Tem certeza que deseja sair? Você precisará fazer login novamente para acessar o app.
      </p>
    </Modal>
  )

  if (isMobile) {
    return (
      <>
        {addModal}
        {editRecModal}
        {logoutModal}
        {resetModal}
        <div className="flex flex-col h-full">
          <header className="shrink-0 flex items-center gap-3 px-4 h-14 border-b border-bg-border bg-bg-surface">
            <button
              onClick={() => navigate(-1)}
              className="text-text-muted hover:text-text-primary text-lg leading-none transition-colors"
              aria-label="Voltar"
            >
              ←
            </button>
            <h1 className="text-sm font-medium text-text-primary">Configurações</h1>
          </header>
          <main className="flex-1 overflow-y-auto p-4">{content}</main>
        </div>
      </>
    )
  }

  return (
    <>
      {addModal}
      {editRecModal}
      {logoutModal}
      {resetModal}
      <div className="p-6 max-w-xl mx-auto">
        <h1 className="text-[22px] font-medium tracking-tight text-text-primary mb-6">
          Configurações
        </h1>
        {content}
      </div>
    </>
  )
}
