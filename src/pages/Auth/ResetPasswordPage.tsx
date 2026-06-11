import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { resetPassword } from '../../services/auth'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'

const schema = z
  .object({
    nova_senha: z.string().min(8, 'Mínimo 8 caracteres'),
    confirmar_senha: z.string(),
  })
  .refine((d) => d.nova_senha === d.confirmar_senha, {
    message: 'As senhas não coincidem',
    path: ['confirmar_senha'],
  })

type FormData = z.infer<typeof schema>
type Status = 'idle' | 'success' | 'error'

export default function ResetPasswordPage() {
  // FE-04: token capturado uma única vez e removido da URL (histórico/referrer)
  const [token] = useState<string | null>(() =>
    new URLSearchParams(window.location.search).get('token')
  )
  const [status, setStatus] = useState<Status>('idle')

  useEffect(() => {
    if (window.location.search) {
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isValid },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    mode: 'onChange',
  })

  if (!token) return <Navigate to="/login" replace />

  const onSubmit = async (data: FormData) => {
    try {
      await resetPassword(token, data.nova_senha)
      setStatus('success')
    } catch {
      setStatus('error')
    }
  }

  if (status === 'success') {
    return (
      <div className="bg-bg-surface rounded-lg p-6 flex flex-col gap-6">
        <div>
          <h1 className="text-text-primary text-lg font-medium">Senha redefinida</h1>
        </div>

        <p className="text-text-muted text-sm leading-relaxed">
          Sua senha foi alterada com sucesso. Você já pode fazer login com a nova senha.
        </p>

        <Link
          to="/login"
          className="text-center text-sm text-amber hover:text-amber-light transition-colors"
        >
          Fazer login
        </Link>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="bg-bg-surface rounded-lg p-6 flex flex-col gap-6">
        <div>
          <h1 className="text-text-primary text-lg font-medium">Link inválido ou expirado</h1>
        </div>

        <p className="text-text-muted text-sm leading-relaxed">
          Este link de recuperação não é mais válido. Solicite um novo link para redefinir sua senha.
        </p>

        <Link
          to="/forgot-password"
          className="text-center text-sm text-amber hover:text-amber-light transition-colors"
        >
          Solicitar novo link
        </Link>
      </div>
    )
  }

  return (
    <div className="bg-bg-surface rounded-lg p-6 flex flex-col gap-6">
      <div>
        <h1 className="text-text-primary text-lg font-medium">Nova senha</h1>
        <p className="text-text-muted text-sm mt-1">Escolha uma nova senha para sua conta.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <Input
          id="nova_senha"
          label="Nova senha"
          type="password"
          placeholder="••••••••"
          autoComplete="new-password"
          showToggle
          error={errors.nova_senha?.message}
          {...register('nova_senha')}
        />
        <Input
          id="confirmar_senha"
          label="Confirmar nova senha"
          type="password"
          placeholder="••••••••"
          autoComplete="new-password"
          showToggle
          error={errors.confirmar_senha?.message}
          {...register('confirmar_senha')}
        />

        <Button
          type="submit"
          isLoading={isSubmitting}
          disabled={!isValid || isSubmitting}
          className="mt-2"
        >
          Redefinir senha
        </Button>
      </form>

      <Link
        to="/login"
        className="text-center text-sm text-text-muted hover:text-text-primary transition-colors"
      >
        Voltar para o login
      </Link>
    </div>
  )
}
