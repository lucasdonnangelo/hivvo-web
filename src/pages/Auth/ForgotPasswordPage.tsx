import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link } from 'react-router-dom'
import { forgotPassword } from '../../services/auth'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'

const schema = z.object({
  email: z.string().email('E-mail inválido'),
})

type FormData = z.infer<typeof schema>

export default function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isValid },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    mode: 'onChange',
  })

  const onSubmit = async (data: FormData) => {
    try {
      await forgotPassword(data.email)
    } catch {
      // mensagem genérica independente do resultado — não revelar se email existe
    } finally {
      setSubmitted(true)
    }
  }

  if (submitted) {
    return (
      <div className="bg-bg-surface rounded-lg p-6 flex flex-col gap-6">
        <div>
          <h1 className="text-text-primary text-lg font-medium">Verifique seu e-mail</h1>
        </div>

        <p className="text-text-muted text-sm leading-relaxed">
          Se o e-mail estiver cadastrado, você receberá um link de recuperação em breve.
        </p>

        <Link
          to="/login"
          className="text-center text-sm text-amber hover:text-amber-light transition-colors"
        >
          Voltar para o login
        </Link>
      </div>
    )
  }

  return (
    <div className="bg-bg-surface rounded-lg p-6 flex flex-col gap-6">
      <div>
        <h1 className="text-text-primary text-lg font-medium">Recuperar senha</h1>
        <p className="text-text-muted text-sm mt-1">
          Informe seu e-mail e enviaremos um link para redefinir sua senha.
        </p>
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

        <Button
          type="submit"
          isLoading={isSubmitting}
          disabled={!isValid || isSubmitting}
          className="mt-2"
        >
          Enviar link
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
