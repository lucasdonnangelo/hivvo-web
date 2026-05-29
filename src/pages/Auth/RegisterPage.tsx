import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { register as registerUser, login } from '../../services/auth'
import { useAuthStore } from '../../store/authStore'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'

const schema = z
  .object({
    email: z.string().email('E-mail inválido'),
    nome_completo: z.string().min(2, 'Mínimo 2 caracteres'),
    username: z.string().min(3, 'Mínimo 3 caracteres'),
    password: z.string().min(8, 'Mínimo 8 caracteres'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Senhas não coincidem',
    path: ['confirmPassword'],
  })

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
  return 'Erro ao criar conta. Tente novamente.'
}

type FormData = z.infer<typeof schema>

export default function RegisterPage() {
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
      await registerUser({
        email: data.email,
        username: data.username,
        nome_completo: data.nome_completo,
        password: data.password,
      })
      const user = await login({ email: data.email, password: data.password })
      setUser(user)
      navigate('/dashboard', { replace: true })
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: unknown } } })
        ?.response?.data?.detail
      setServerError(extractDetail(detail))
    }
  }

  return (
    <div className="bg-bg-surface rounded-lg p-6 flex flex-col gap-6">
      <div>
        <h1 className="text-text-primary text-lg font-medium">Criar conta</h1>
        <p className="text-text-muted text-sm mt-1">Comece sua jornada financeira</p>
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
          id="nome_completo"
          label="Nome completo"
          type="text"
          placeholder="Seu nome completo"
          autoComplete="name"
          error={errors.nome_completo?.message}
          {...register('nome_completo')}
        />
        <Input
          id="username"
          label="Nome de usuário"
          type="text"
          placeholder="seunome"
          autoComplete="username"
          error={errors.username?.message}
          {...register('username')}
        />
        <Input
          id="password"
          label="Senha"
          type="password"
          placeholder="••••••••"
          autoComplete="new-password"
          error={errors.password?.message}
          {...register('password')}
        />
        <Input
          id="confirmPassword"
          label="Confirmar senha"
          type="password"
          placeholder="••••••••"
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />

        {serverError && <p className="text-xs text-danger">{serverError}</p>}

        <Button
          type="submit"
          isLoading={isSubmitting}
          disabled={!isValid || isSubmitting}
          className="mt-2"
        >
          Criar conta
        </Button>
      </form>

      <p className="text-center text-sm text-text-muted">
        Já tem conta?{' '}
        <Link
          to="/login"
          className="text-amber hover:text-amber-light transition-colors"
        >
          Entrar
        </Link>
      </p>
    </div>
  )
}
