/** Interruptor liga/desliga. Primeiro switch do projeto.
 *
 * `<button role="switch">` e não `<input type="checkbox">` porque o controle
 * não vive dentro de um form e nunca é submetido: o clique JÁ É a ação. O
 * `role="switch"` com `aria-checked` é o que faz o leitor de tela anunciar
 * "ligado/desligado" em vez de "caixa de seleção marcada" — a diferença
 * importa numa preferência que só tem dois estados e efeito imediato.
 *
 * Sendo um <button> nativo, Tab e Espaço/Enter funcionam sem `onKeyDown`
 * próprio.
 *
 * O BOTÃO É O ALVO (44×44), O <span> INTERNO É O TRILHO (44×24). Separados de
 * propósito: a primeira versão punha o visual no próprio botão e usava `my-2.5`
 * para "completar" a altura — mas margem fica FORA da caixa de clique, então o
 * alvo tinha 24px, abaixo do mínimo de 44. Não dava para ver: o desenho é
 * idêntico nos dois casos. Quem pegou foi o harness medindo
 * `getBoundingClientRect()` em viewport de 390px.
 *
 * APRESENTACIONAL: não conhece axios nem store. Estado e erro moram em quem
 * usa. É o que permite montá-lo no harness sem backend (mesma disciplina do
 * FeedbackForm).
 */
interface ToggleProps {
  id: string
  checked: boolean
  onChange: (valor: boolean) => void
  /** Rótulo acessível — o texto visível fica na linha, fora do controle. */
  label: string
  disabled?: boolean
}

export default function Toggle({ id, checked, onChange, label, disabled }: ToggleProps) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={[
        // Alvo de toque: 44×44 REAIS (h-11/w-11 no próprio botão, não margem).
        'group shrink-0 inline-flex items-center justify-center',
        'w-11 h-11 outline-none bg-transparent',
        // Desabilitado ainda MOSTRA o estado (cor mantida, opacidade reduzida):
        // durante o salvamento o usuário precisa ver para onde foi.
        disabled ? 'opacity-50 cursor-wait' : 'cursor-pointer',
      ].join(' ')}
    >
      {/* Trilho — o que se vê. O anel de foco vem daqui (via `group`) para
          desenhar em volta do trilho, e não do alvo invisível de 44px. */}
      <span
        className={[
          'relative inline-flex items-center w-11 h-6 rounded-full transition-colors',
          'group-focus-visible:ring-2 group-focus-visible:ring-amber',
          'group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-bg-surface',
          checked ? 'bg-amber' : 'bg-bg-border',
        ].join(' ')}
      >
        <span
          className={[
            'inline-block w-4 h-4 rounded-full bg-white shadow-sm transition-transform',
            checked ? 'translate-x-6' : 'translate-x-1',
          ].join(' ')}
        />
      </span>
    </button>
  )
}
