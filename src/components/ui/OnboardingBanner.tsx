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
    // Card do app, não um container próprio: `bg-bg-surface rounded-lg p-4` é o
    // que TODO card desta mesma página usa (OverviewPage: os quatro do topo, o
    // donut, as últimas transações, os dois da projeção) — e nenhum deles tem
    // borda. `rounded-xl` era órfão: 7 usos no app inteiro, nenhum em card de
    // página (bolha de chat, skeleton, textarea).
    //
    // A borda âmbar SAIU. Ela queria dizer "isto é o onboarding" — o que o badge
    // logo abaixo já diz em palavras. Em cor, ela era o sexto sentido empilhado
    // num token que já carrega selecionado, paga_parcial, estorno, reconciliação
    // e "próximo passo"; e rolava na MESMA tela que o `ring-1 ring-amber` do
    // ProjectionHighlight, que significa "em destaque". Dois cards âmbares com
    // sentidos diferentes a dois blocos de distância não somam, se anulam.
    <div className="relative rounded-lg bg-bg-surface p-4">
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

      {/* Sem `gap`: as divisórias das linhas é que separam, como em toda lista
          dentro de card no app. */}
      <ol className="flex flex-col">
        {passos.map((passo) => {
          const atual = passo.num === proximo
          // `success` (não âmbar) no concluído: âmbar já significa "próxima ação"
          // três linhas acima, e concluído É juízo de resultado — o sentido que o
          // token carrega.
          //
          // O pendente é neutro pelo PREENCHIMENTO, não pelo texto: o numeral é
          // conteúdo, não decoração, então ele fica em `text-primary` e quem
          // separa os três estados é a cor da pastilha.
          //
          // A pastilha do pendente era `bg-bg-surface` porque a LINHA era `bg-bg`.
          // Agora a linha é o card (`bg-bg-surface`), então ela inverte para
          // `bg-bg` — sem isso seria superfície sobre superfície, e o canal que
          // separa os estados sumiria.
          //
          // CONTRASTE — remedido no harness DEPOIS da mudança de fundo, nas duas
          // viewports, com o fundo efetivo composto (as pastilhas são /15 sobre o
          // card, então a cor crua daria número fantasia). Não são estimativas:
          //
          //   concluído  success  sobre rgb(45,60,46)   4,98:1
          //   próximo    amber    sobre rgb(72,55,33)   5,24:1
          //   pendente   primary  sobre rgb(26,23,20)  15,73:1
          //
          // Os três acima de 4,5:1 (AA para os 12px do numeral). Os dois primeiros
          // caíram — eram 7,61 e mais folgados sobre `bg-bg` — porque a pastilha
          // agora repousa no card, e não mais no fundo escuro da linha. Continuam
          // passando, mas com menos margem: se alguém clarear `bg-surface`,
          // REMEDIR antes de assumir que ainda passa.
          const marca = passo.feito
            ? 'bg-success/15 border-success/30 text-success'
            : atual
              ? 'bg-amber/15 border-amber/30 text-amber'
              : 'bg-bg border-bg-border text-text-primary'

          return (
            <li
              key={passo.num}
              className={[
                // Linha, não card. O app não aninha card em card em lugar
                // nenhum: uma lista dentro de card é `border-b border-bg-border
                // last:border-0` (as últimas transações e as linhas da projeção,
                // nesta mesma página) ou `divide-y` (SettingsSection). Este é o
                // mesmo `py-3 border-b border-bg-border last:border-0` do
                // TransactionItem, letra por letra.
                'py-3 border-b border-bg-border last:border-0',
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
                  {/* ACHADO DA REMEDIÇÃO, deixado à vista de propósito.
                      `text-muted` sobre `bg-surface` mede 4,13:1 — abaixo de AA
                      (4,5:1) para os 14px do título e os 12px da descrição.
                      Sobre o `bg-bg` da linha antiga media 4,86:1, e passava.
                      Achatar o card, portanto, PIOROU este número.
                      NÃO foi compensado aqui de propósito: `text-muted` sobre
                      `bg-surface` é o par texto/fundo mais comum do app inteiro
                      (toda descrição dentro de card), e este banner era a
                      exceção — justamente por causa do card aninhado que saiu.
                      Consertar só aqui recriaria a divergência que a conformação
                      veio desfazer; consertar de verdade é subir o token
                      `text-muted`, que é mudança global e precisa da sua
                      decisão. Enquanto isso, o estado do passo NÃO depende deste
                      texto: vive na pastilha (acima) e no sr-only. */}
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
                {/* Continuam três pesos — o conteúdo pede três: a próxima ação,
                    as outras, e a alternativa. O que muda é que os três passam a
                    ser pesos QUE O APP JÁ TEM, em vez de três invenções.
                    Sublinhado saiu: os links sublinhados do app são âmbar
                    (ImportPage, TransactionsPage); sublinhado sobre `text-muted`
                    não existe em outro lugar. Sobra o botão-texto discreto, que
                    é idioma corrente (AssistantPage, ForgotPasswordPage,
                    DesktopLayout). */}
                {passo.alternativa && !passo.feito && (
                  <button
                    onClick={passo.alternativa.onClick}
                    className="shrink-0 text-xs text-text-muted hover:text-text-primary transition-colors"
                  >
                    {passo.alternativa.label}
                  </button>
                )}
                <button
                  onClick={passo.acao.onClick}
                  className={
                    // Sólido e contornado são as variantes `primary` e `ghost`
                    // do Button (o componente não serve aqui: é `w-full px-4
                    // py-3`), copiadas letra por letra — com UM desvio
                    // deliberado. O `ghost` original é `hover:bg-bg-surface`, e
                    // o botão agora está SOBRE bg-surface: o hover seria
                    // invisível. `hover:bg-bg-border` é o que o app usa para
                    // botão sobre superfície (Modal, TransactionItem), e é o
                    // `active` do próprio ghost — então não inventa cor nova.
                    atual
                      ? 'shrink-0 px-3 py-1.5 rounded-md text-xs font-medium bg-amber text-bg hover:bg-amber-light active:bg-amber-dark transition-colors'
                      : 'shrink-0 px-3 py-1.5 rounded-md text-xs font-medium border border-bg-border text-text-primary hover:bg-bg-border transition-colors'
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
