import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { dispensarOnboarding, onboardingDispensado } from '../../lib/onboardingDismiss'

// ─── guia de primeiros passos ────────────────────────────────────────────────
//
// PRESENTACIONAL: quem sabe se o passo foi feito é o OverviewPage (é ele que já
// tem `cards` e `coverage` em mão), e é ele que decide se o banner monta. Aqui
// entram fatos prontos — o mesmo contrato dos StepRevisao da importação, e o que
// torna o componente montável sozinho no dev/harness.
//
// O passo 2 é IMPORTAR, não lançar à mão: uma fatura em PDF vira meses de
// histórico de uma vez, e sem histórico a Análise (passo 3) está vazia. O caminho
// manual fica AO LADO, não escondido: importar exige ter o PDF em mãos, então
// forçar trava quem não tem e esconder desperdiça quem tem.
//
// O passo 3 diz "Análise" porque é assim que a aba está rotulada na navegação
// (DashboardPage/TABS). Mandar o usuário procurar "Resumo" seria mandá-lo
// procurar uma palavra que não existe na tela.

interface OnboardingBannerProps {
  temCartao: boolean
  temHistorico: boolean
  isMobile: boolean
  // A Análise é ABA (estado local do DashboardPage), não rota: não há URL para
  // navegar. Por isso o passo 3 recebe um callback e não um `to`.
  onVerAnalise: () => void
}

export default function OnboardingBanner({
  temCartao,
  temHistorico,
  isMobile,
  onVerAnalise,
}: OnboardingBannerProps) {
  const navigate = useNavigate()
  const usuarioId = useAuthStore((s) => s.user?.id ?? null)
  const [dismissed, setDismissed] = useState(() => onboardingDispensado(usuarioId))

  if (dismissed) return null

  function dismiss() {
    dispensarOnboarding(usuarioId)
    setDismissed(true)
  }

  // O primeiro passo NÃO feito é o único com botão âmbar sólido — âmbar aqui
  // significa "sua próxima ação", e dois âmbares na mesma lista não significam
  // nada. O passo 3 nunca é o "atual": ele é o destino, não uma tarefa.
  const proximo = !temCartao ? 1 : !temHistorico ? 2 : 0

  const passos = [
    {
      num: 1,
      feito: temCartao,
      titulo: 'Cadastre seu cartão',
      desc: 'É o que liga cada compra à fatura certa — e o que a importação de fatura pede.',
      acao: { label: 'Ir para Cartões', onClick: () => navigate('/cards') },
      alternativa: null,
    },
    {
      num: 2,
      feito: temHistorico,
      titulo: 'Importe uma fatura',
      desc: 'Um PDF do banco vira meses de histórico de uma vez, sem digitar linha por linha.',
      acao: { label: 'Importar fatura', onClick: () => navigate('/import/fatura') },
      alternativa: { label: 'ou lance à mão', onClick: () => navigate('/add') },
    },
    {
      num: 3,
      // Sem estado de "feito": olhar a Análise não é tarefa a concluir, é o que
      // os dois passos anteriores destravam.
      feito: false,
      titulo: 'Veja sua Análise',
      desc: 'A aba aqui do lado: quanto entrou e saiu, mês a mês. Ela se enche com o passo 2.',
      acao: { label: 'Abrir Análise', onClick: onVerAnalise },
      alternativa: null,
    },
  ]

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

      <ol className="flex flex-col gap-2">
        {passos.map((passo) => {
          const atual = passo.num === proximo
          // `success` (não âmbar) no concluído: âmbar já significa "próxima ação"
          // três linhas acima, e concluído É juízo de resultado — o sentido que o
          // token carrega. Mede 7,65:1 sobre bg-DEFAULT, que é o fundo da linha.
          //
          // O pendente é neutro pelo PREENCHIMENTO, não pelo texto: `text-muted`
          // no numeral mede 4,13:1 sobre o fundo da linha (medido no harness),
          // abaixo de AA para os 12px daqui — e o numeral é o conteúdo, não
          // decoração. O que separa os três estados é a cor da pastilha.
          const marca = passo.feito
            ? 'bg-success/15 border-success/30 text-success'
            : atual
              ? 'bg-amber/15 border-amber/30 text-amber'
              : 'bg-bg-surface border-bg-border text-text-primary'

          return (
            <li
              key={passo.num}
              className={[
                'p-3 rounded-lg bg-bg border border-bg-border',
                // Mobile: as ações descem para baixo do texto — o passo 2 tem
                // duas, e no desktop elas cabem na mesma linha.
                isMobile ? 'flex flex-col gap-2.5' : 'flex items-center gap-3',
              ].join(' ')}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span
                  aria-hidden
                  className={`w-7 h-7 shrink-0 rounded-full border flex items-center justify-center text-xs font-semibold ${marca}`}
                >
                  {passo.feito ? '✓' : passo.num}
                </span>
                {/* O estado não pode viver só na cor e no glifo. */}
                <span className="sr-only">
                  Passo {passo.num},{' '}
                  {passo.feito ? 'concluído' : atual ? 'próximo passo' : 'ainda não feito'}.
                </span>
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm font-medium leading-snug ${
                      passo.feito ? 'text-text-muted' : 'text-text-primary'
                    }`}
                  >
                    {passo.titulo}
                  </p>
                  <p className="text-xs text-text-muted mt-0.5 leading-relaxed">{passo.desc}</p>
                </div>
              </div>

              <div
                className={[
                  'flex items-center gap-3',
                  isMobile ? 'pl-10' : 'shrink-0 ml-auto',
                ].join(' ')}
              >
                {passo.alternativa && !passo.feito && (
                  <button
                    onClick={passo.alternativa.onClick}
                    className="shrink-0 text-xs text-text-muted hover:text-text-primary underline underline-offset-2 transition-colors"
                  >
                    {passo.alternativa.label}
                  </button>
                )}
                <button
                  onClick={passo.acao.onClick}
                  className={
                    atual
                      ? 'shrink-0 px-3 py-1.5 rounded-md text-xs font-medium bg-amber text-bg hover:bg-amber-light active:bg-amber-dark transition-colors'
                      : 'shrink-0 px-3 py-1.5 rounded-md text-xs font-medium border border-bg-border text-text-primary hover:bg-bg-surface active:bg-bg-border transition-colors'
                  }
                >
                  {passo.acao.label}
                </button>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
