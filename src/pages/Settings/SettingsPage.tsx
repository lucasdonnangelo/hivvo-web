import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from 'react-router-dom'
import { useBreakpoint } from '../../hooks/useBreakpoint'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import { useCategories, useCreateCategory, useDeleteCategory } from '../../hooks/useCategories'
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

const QUICK_EMOJIS = ['🍔','🚗','🏠','💊','📚','🎮','👕','📱','✈️','🐾','💰','💻','📈','🎯','📦']

function extractEmojiAndName(text: string): { icone: string; nome: string } {
  if (!text) return { icone: '📦', nome: '' }
  const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
  const [first] = seg.segment(text)
  if (first && /\p{Extended_Pictographic}/u.test(first.segment)) {
    return { icone: first.segment, nome: text.slice(first.segment.length).trim() }
  }
  return { icone: '📦', nome: text }
}

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
  const createMutation = useCreateCategory()
  const deleteMutation = useDeleteCategory()

  const [showAddModal, setShowAddModal] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [catNameError, setCatNameError] = useState('')
  const [deletingId, setDeletingId] = useState<number | null>(null)

  function openAddModal() {
    setNewCatName('')
    setCatNameError('')
    setShowAddModal(true)
  }

  function handleAddCatSubmit() {
    const trimmed = newCatName.trim()
    const { icone, nome } = extractEmojiAndName(trimmed)
    if (nome.length < 2) {
      setCatNameError('Mínimo 2 caracteres no nome.')
      return
    }
    const duplicate = categories.some(
      (c) => c.nome.toLowerCase() === nome.toLowerCase(),
    )
    if (duplicate) {
      setCatNameError('Já existe uma categoria com esse nome.')
      return
    }
    createMutation.mutate({ nome, icone }, {
      onSuccess: () => setShowAddModal(false),
      onError: () => setCatNameError('Erro ao criar. Tente novamente.'),
    })
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

      {/* ── Categorias ── */}
      <Section title="Categorias">
        <SettingsRow>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-text-muted">Suas categorias customizadas.</p>
            <button
              onClick={openAddModal}
              className="text-xs text-amber hover:text-amber-light transition-colors font-medium"
            >
              + Adicionar
            </button>
          </div>

          {catsLoading ? (
            <div className="flex flex-col gap-2">
              {[0, 1].map((i) => (
                <div key={i} className="h-9 rounded-md bg-bg-border animate-pulse" />
              ))}
            </div>
          ) : categories.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-4 text-center">
              <p className="text-sm text-text-muted">
                Nenhuma categoria disponível.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {categories.map((cat) =>
                deletingId !== null && deletingId === cat.id ? (
                  <div
                    key={cat.id}
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
                        onClick={() =>
                          deleteMutation.mutate(cat.id, {
                            onSuccess: () => setDeletingId(null),
                          })
                        }
                        disabled={deleteMutation.isPending}
                        className="text-xs text-danger hover:text-danger/80 font-medium transition-colors disabled:opacity-50"
                      >
                        {deleteMutation.isPending ? '…' : 'Sim'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    key={cat.id}
                    className="flex items-center justify-between gap-2 px-2 py-2 rounded-md hover:bg-bg-border/50 transition-colors group"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-base leading-none">{cat.icone}</span>
                      <span className="text-sm text-text-primary truncate">{cat.nome}</span>
                    </div>
                    {cat.usuario_id !== null && (
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

  const addModal = showAddModal && (
    <Modal
      title="Nova categoria"
      onClose={() => setShowAddModal(false)}
      footer={
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setShowAddModal(false)}>
            Cancelar
          </Button>
          <Button isLoading={createMutation.isPending} onClick={handleAddCatSubmit}>
            Adicionar
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-2">
        <label className="text-xs text-text-muted" htmlFor="cat-name">
          Nome
        </label>
        <input
          id="cat-name"
          type="text"
          value={newCatName}
          onChange={(e) => {
            setNewCatName(e.target.value)
            if (catNameError) setCatNameError('')
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAddCatSubmit()
          }}
          placeholder="Ex: 🐾 Pets"
          autoFocus
          className={`w-full rounded-md bg-bg border px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-amber transition-colors ${
            catNameError ? 'border-danger' : 'border-bg-border'
          }`}
        />
        {!isMobile && (
          <div className="flex flex-wrap gap-1">
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  setNewCatName((prev) =>
                    emoji + ' ' + prev.replace(/^\p{Extended_Pictographic}\s*/u, ''),
                  )
                  setCatNameError('')
                }}
                className="text-base leading-none p-1 rounded hover:bg-bg-border transition-colors"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
        {catNameError && <p className="text-xs text-danger">{catNameError}</p>}
      </div>
    </Modal>
  )

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
