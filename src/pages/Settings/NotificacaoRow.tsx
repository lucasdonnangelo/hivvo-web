import { useState } from 'react'
import Toggle from '../../components/ui/Toggle'
import { estadoDoToggle } from '../../lib/preferencias'

/** Linha do aviso de vencimento em Configurações › Notificações.
 *
 * APRESENTACIONAL, no mesmo molde do FeedbackForm: não lê `window`, não
 * conhece axios e não toca o store. Recebe o valor do servidor e uma função de
 * salvar. É o que permite montá-lo no harness com viewport real — se a lógica
 * de otimismo/rollback ficasse no SettingsPage, o harness exercitaria uma
 * CÓPIA dela, e um harness que testa cópia atesta um comportamento que o
 * produto pode não ter.
 *
 * `onSalvar` devolve o valor CONFIRMADO pelo servidor (e não void) porque quem
 * fecha o estado é o servidor, não o clique.
 */
interface NotificacaoRowProps {
  /** `undefined` enquanto o usuário não chegou (boot antes do getMe). */
  valor: boolean | undefined
  onSalvar: (valor: boolean) => Promise<boolean>
  onErro: (mensagem: string) => void
}

const ERRO_SALVAR = 'Não foi possível salvar. O aviso continua como estava.'

export default function NotificacaoRow({ valor, onSalvar, onErro }: NotificacaoRowProps) {
  // Optimistic: o toggle vira NA HORA e volta sozinho se o servidor recusar.
  // Um switch que espera o round-trip para se mexer parece quebrado — e este
  // não tem estado intermediário legítimo (ligado ou desligado, só).
  const [pendente, setPendente] = useState<boolean | undefined>(undefined)
  const [salvando, setSalvando] = useState(false)

  const { ligado, carregando } = estadoDoToggle(pendente ?? valor)

  async function handleChange(novo: boolean) {
    setPendente(novo)
    setSalvando(true)
    try {
      await onSalvar(novo)
      setPendente(undefined)
    } catch {
      // ROLLBACK VISÍVEL. Sem ele o toggle fica mostrando "desligado" com o
      // aviso ainda LIGADO no servidor — o pior desfecho para um controle de
      // notificação, porque a pessoa acredita que resolveu e só descobre no
      // próximo e-mail.
      setPendente(undefined)
      onErro(ERRO_SALVAR)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex flex-col gap-1 min-w-0">
        <label
          htmlFor="toggle-aviso-vencimento"
          className="text-sm text-text-primary cursor-pointer"
        >
          Aviso de vencimento
        </label>
        {/* Diz O QUE chega e QUANDO, sem prometer entrega: e-mail falha e o
            backend não garante isso. Mesma regra da copy do próprio e-mail e
            do texto dos Termos. */}
        <p className="text-sm text-text-muted">
          Um e-mail 3 dias antes, com as faturas que vencem e o valor em aberto. No
          máximo um por dia, e só quando há fatura a vencer.
        </p>
      </div>
      <Toggle
        id="toggle-aviso-vencimento"
        label="Aviso de vencimento por e-mail"
        checked={ligado}
        disabled={carregando || salvando}
        onChange={handleChange}
      />
    </div>
  )
}
