import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { login } from '../../services/auth'
import { useAuthStore } from '../../store/authStore'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'

const schema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
})

type FormData = z.infer<typeof schema>

export default function LoginPage() {
  const navigate = useNavigate()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const setUser = useAuthStore((s) => s.setUser)
  const [serverError, setServerError] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isValid },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    mode: 'onChange',
  })

  if (isAuthenticated) return <Navigate to="/dashboard" replace />

  const onSubmit = async (data: FormData) => {
    setServerError('')
    try {
      const user = await login({ email: data.email, password: data.password })
      setUser(user)
      navigate('/dashboard', { replace: true })
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail
      setServerError(detail ?? 'Credenciais inválidas. Tente novamente.')
    }
  }

  return (
    <div className="bg-bg-surface rounded-lg p-6 flex flex-col gap-6">
      <div>
        <h1 className="text-text-primary text-lg font-medium">Entrar</h1>
        <p className="text-text-muted text-sm mt-1">Acesse sua conta Hivvo</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <Input
          id="email"
          label="E-mail"
          type="email"
          placeholder="seu@email.com"
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
        />
        <Input
          id="password"
          label="Senha"
          type="password"
          placeholder="••••••••"
          autoComplete="current-password"
          showToggle
          error={errors.password?.message}
          {...register('password')}
        />

        {serverError && <p className="text-xs text-danger">{serverError}</p>}

        <Button
          type="submit"
          isLoading={isSubmitting}
          disabled={!isValid || isSubmitting}
          className="mt-2"
        >
          Entrar
        </Button>

        <p className="text-center text-xs text-text-muted">
          <Link to="/forgot-password" className="text-amber hover:text-amber-light transition-colors">
            Esqueceu a senha?
          </Link>
        </p>
      </form>

      <p className="text-center text-sm text-text-muted">
        Não tem conta?{' '}
        <Link
          to="/register"
          className="text-amber hover:text-amber-light transition-colors"
        >
          Criar conta
        </Link>
      </p>
    </div>
  )
}
