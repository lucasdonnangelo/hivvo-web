import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const STORAGE_KEY = 'hivvo_onboarding_dismissed'

const STEPS = [
  {
    num: 1,
    icon: '▭',
    title: 'Adicione seu primeiro cartão',
    desc: 'Cadastre seus cartões de crédito para acompanhar faturas e parcelamentos.',
    action: 'Ir para Cartões',
    to: '/cards',
  },
  {
    num: 2,
    icon: '+',
    title: 'Registre sua primeira transação',
    desc: 'Anote receitas e despesas para ter controle total do seu orçamento.',
    action: 'Adicionar transação',
    to: '/add',
  },
  {
    num: 3,
    icon: '✦',
    title: 'Pergunte algo ao assistente',
    desc: 'O assistente de IA analisa seus dados e responde dúvidas financeiras.',
    action: 'Abrir assistente',
    to: '/assistant',
  },
]

export default function OnboardingBanner() {
  const navigate = useNavigate()
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(STORAGE_KEY) === '1',
  )

  if (dismissed) return null

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, '1')
    setDismissed(true)
  }

  return (
    <div className="relative rounded-xl bg-bg-surface border border-amber/30 p-5">
      <button
        onClick={dismiss}
        className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center rounded-full text-text-muted hover:text-text-primary hover:bg-bg-border transition-colors text-xs"
        aria-label="Dispensar onboarding"
      >
        ✕
      </button>

      <div className="mb-4 pr-6">
        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber/15 text-amber border border-amber/30">
          Primeiros passos
        </span>
        <h2 className="mt-2 text-base font-medium text-text-primary">Bem-vindo ao Hivvo!</h2>
        <p className="text-sm text-text-muted mt-0.5">
          Siga os passos abaixo para começar a controlar suas finanças.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {STEPS.map((step) => (
          <div
            key={step.num}
            className="flex items-center gap-3 p-3 rounded-lg bg-bg border border-bg-border"
          >
            <span className="w-7 h-7 shrink-0 rounded-full bg-amber/15 border border-amber/30 flex items-center justify-center text-amber text-xs font-semibold">
              {step.num}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary leading-snug">{step.title}</p>
              <p className="text-xs text-text-muted mt-0.5 leading-relaxed">{step.desc}</p>
            </div>
            <button
              onClick={() => navigate(step.to)}
              className="shrink-0 px-3 py-1.5 rounded-md text-xs font-medium bg-amber text-bg hover:bg-amber-light active:bg-amber-dark transition-colors"
            >
              {step.action}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
