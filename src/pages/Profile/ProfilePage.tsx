import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from 'react-router-dom'
import { useBreakpoint } from '../../hooks/useBreakpoint'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import { Section, SettingsRow } from '../../components/ui/SettingsSection'
import { useAuthStore } from '../../store/authStore'
import { useUIStore } from '../../store/uiStore'
import { updateMe, changePassword, logout, logoutAll } from '../../services/auth'
import { errorDetail } from '../../lib/extractDetail'

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

export default function ProfilePage() {
  const isMobile = useBreakpoint('md')
  const navigate = useNavigate()

  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const addToast = useUIStore((s) => s.addToast)

  // ── Nome ──────────────────────────────────────────────────────────────────
  // Edita nome_completo. Até este batch o campo (rotulado "Nome") gravava o
  // `username` — quem já o editou vê o valor mudar aqui: é a correção.
  const [name, setName] = useState(user?.nome_completo ?? '')
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
      setNameError(errorDetail(err, 'Erro ao salvar. Tente novamente.'))
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
    setError: setPwError,
  } = useForm<PwForm>({ resolver: zodResolver(pwSchema) })

  async function doLogout() {
    try {
      await logout()
    } catch {
      // Sessão já pode estar inválida no servidor; sair localmente mesmo assim.
    }
    clearAuth()
    navigate('/login', { replace: true })
  }

  async function onPasswordSubmit(data: PwForm) {
    try {
      await changePassword(data.senha_atual, data.nova_senha)
      // O backend revoga TODAS as sessões ao trocar a senha, mas o access token
      // atual é JWT stateless e sobrevive ~30 min. Sem logout explícito o usuário
      // ficaria num limbo: navegando com um token válido sobre uma sessão já
      // revogada, até o primeiro refresh falhar. Então saímos na hora.
      addToast({ message: 'Senha alterada. Entre novamente.', type: 'success' })
      await doLogout()
    } catch {
      setPwError('senha_atual', { message: 'Senha atual incorreta.' })
      addToast({ message: 'Erro ao alterar senha. Verifique os dados e tente novamente.', type: 'error' })
    }
  }

  // ── Logout ────────────────────────────────────────────────────────────────
  const [logoutModalOpen, setLogoutModalOpen] = useState(false)

  // ── Sair de todos os dispositivos ─────────────────────────────────────────
  // Sem senha: é disruptivo, mas reversível (basta entrar de novo). Modal, e não
  // confirm inline, para ter o mesmo peso do "Sair da conta" logo abaixo.
  const [logoutAllModalOpen, setLogoutAllModalOpen] = useState(false)
  const [logoutAllError, setLogoutAllError] = useState('')
  const [isLoggingOutAll, setIsLoggingOutAll] = useState(false)

  async function handleLogoutAll() {
    setIsLoggingOutAll(true)
    setLogoutAllError('')
    try {
      await logoutAll()
      // O backend já revogou tudo e limpou os cookies desta sessão — chamar
      // /auth/logout aqui seria bater numa sessão que não existe mais.
      clearAuth()
      navigate('/login', { replace: true })
    } catch (err: unknown) {
      setLogoutAllError(errorDetail(err, 'Não foi possível sair. Tente novamente.'))
      setIsLoggingOutAll(false)
    }
  }

  const content = (
    <div className="flex flex-col gap-6">

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
            <p className="text-xs text-text-muted">
              Ao trocar a senha, todas as sessões são encerradas — você entrará de novo com a
              senha nova.
            </p>
            <Button type="submit" isLoading={isSubmitting}>
              Salvar senha
            </Button>
          </form>
        </SettingsRow>

        {/* Sair de todos os dispositivos */}
        <SettingsRow>
          <p className="text-sm text-text-muted mb-3">
            Você sairá de todos os dispositivos, incluindo este. Outros dispositivos podem
            levar até 30 minutos para serem desconectados.
          </p>
          <button
            onClick={() => setLogoutAllModalOpen(true)}
            className="w-full flex items-center justify-center px-4 py-3 rounded-md text-sm font-medium border border-bg-border text-text-primary hover:bg-bg-border/50 active:bg-bg-border transition-colors duration-150"
          >
            Sair de todos os dispositivos
          </button>
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

  const logoutModal = logoutModalOpen && (
    <Modal
      title="Sair da conta"
      onClose={() => setLogoutModalOpen(false)}
      footer={
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setLogoutModalOpen(false)}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={doLogout}>
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

  const logoutAllModal = logoutAllModalOpen && (
    <Modal
      title="Sair de todos os dispositivos?"
      onClose={() => {
        setLogoutAllModalOpen(false)
        setLogoutAllError('')
      }}
      footer={
        <div className="flex gap-2">
          <Button
            variant="ghost"
            onClick={() => {
              setLogoutAllModalOpen(false)
              setLogoutAllError('')
            }}
          >
            Cancelar
          </Button>
          <Button variant="danger" isLoading={isLoggingOutAll} onClick={handleLogoutAll}>
            Sair de todos
          </Button>
        </div>
      }
    >
      {/* Não repete o texto de apoio da linha palavra por palavra — aqui diz a
          consequência: este dispositivo cai junto, e os outros demoram. */}
      <div className="flex flex-col gap-3">
        <p className="text-sm text-text-muted leading-relaxed">
          Você vai precisar entrar de novo neste dispositivo. Outros dispositivos podem levar
          até 30 minutos para serem desconectados.
        </p>
        <p className="text-sm text-text-muted leading-relaxed">
          A sua conta e os seus dados continuam intactos.
        </p>
        {logoutAllError && <p className="text-xs text-danger">{logoutAllError}</p>}
      </div>
    </Modal>
  )

  if (isMobile) {
    return (
      <>
        {logoutAllModal}
        {logoutModal}
        <div className="flex flex-col h-full">
          <header className="shrink-0 flex items-center gap-3 px-4 h-14 border-b border-bg-border bg-bg-surface">
            <button
              onClick={() => navigate(-1)}
              className="text-text-muted hover:text-text-primary text-lg leading-none transition-colors"
              aria-label="Voltar"
            >
              ←
            </button>
            <h1 className="text-sm font-medium text-text-primary">Perfil</h1>
          </header>
          <main className="flex-1 overflow-y-auto p-4">{content}</main>
        </div>
      </>
    )
  }

  return (
    <>
      {logoutAllModal}
      {logoutModal}
      <div className="p-6 max-w-xl mx-auto">
        <h1 className="text-[22px] font-medium tracking-tight text-text-primary mb-6">
          Perfil
        </h1>
        {content}
      </div>
    </>
  )
}
