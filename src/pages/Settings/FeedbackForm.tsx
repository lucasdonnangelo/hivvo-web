import { useState } from 'react'
import Button from '../../components/ui/Button'
import { errorDetail } from '../../lib/extractDetail'
import { MAX_MENSAGEM, validarMensagem } from '../../lib/feedback'

// Mesmas classes do campo de recorrência do SettingsPage — tokens do tema, nada
// de cor solta.
const campoClass =
  'w-full rounded-md bg-bg border px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-amber transition-colors resize-y'

// A partir daqui o contador aparece. Antes disso ele seria só ruído: ninguém
// escreve 3.500 caracteres por acidente, e um contador permanente sugere que
// existe um tamanho "certo" de feedback.
const AVISO_A_PARTIR_DE = MAX_MENSAGEM - 500

// Cópia própria do 429 — o default compartilhado ("Muitas tentativas...") serve
// para importação e login, mas aqui dá para dizer exatamente o que aconteceu e,
// principalmente, que o texto não se perdeu.
const ERRO_LIMITE_FEEDBACK =
  'Você já enviou várias mensagens na última hora. Aguarde um pouco antes de mandar outra.'

// Rede fora / erro sem corpo. Quando o backend responde 502, o `detail` dele
// entra no lugar desta frase — as duas dizem a mesma coisa, e é o backend que
// sabe se foi ele ou o provedor de e-mail.
const ERRO_ENVIO =
  'Não foi possível enviar sua mensagem agora. Tente de novo em instantes.'

interface FeedbackFormProps {
  /** E-mail do usuário logado — a cópia diz para ONDE a resposta vai. */
  email: string
  /**
   * Injetado pela página: monta o contexto (que precisa ler `window`) e chama o
   * service. Fica de fora daqui para este componente continuar montável sozinho,
   * sem axios nem auth — é o que permite o harness exercitar falha e limite sem
   * backend nenhum.
   */
  onEnviar: (mensagem: string) => Promise<void>
}

export default function FeedbackForm({ email, onEnviar }: FeedbackFormProps) {
  const [texto, setTexto] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)

  async function handleEnviar() {
    // Validação ANTES do envio, e o botão nunca fica apagado esperando por ela:
    // clicar com a caixa vazia produz a frase abaixo do campo, dizendo o que
    // falta. Botão disabled em silêncio deixa o usuário adivinhando.
    const invalido = validarMensagem(texto)
    if (invalido) {
      setErro(invalido)
      return
    }

    setEnviando(true)
    setErro('')
    try {
      await onEnviar(texto.trim())
      // Só limpa DEPOIS do sucesso. Ver o catch.
      setTexto('')
      setEnviado(true)
    } catch (err: unknown) {
      // O texto digitado NÃO é tocado aqui. Sem tabela do outro lado, esta caixa
      // é a única cópia da mensagem: limpá-la numa falha de envio apagaria o que
      // o usuário acabou de escrever, e ele não teria como recuperar.
      setErro(errorDetail(err, ERRO_ENVIO, ERRO_LIMITE_FEEDBACK))
    } finally {
      setEnviando(false)
    }
  }

  // Confirmação EM PÉ, não toast: a frase que importa é "a resposta vem por
  // e-mail", e um toast some em três segundos levando-a junto.
  if (enviado) {
    return (
      <div className="flex flex-col gap-2" data-feedback="enviado">
        <p className="text-sm text-text-primary">Mensagem enviada. Obrigado.</p>
        <p className="text-sm text-text-muted">
          Ela chegou direto para quem faz o Hivvo. Se precisarmos de mais detalhes, respondemos
          em {email}.
        </p>
        <button
          onClick={() => setEnviado(false)}
          className="self-start text-xs text-amber hover:text-amber-light transition-colors font-medium"
        >
          Enviar outra
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-text-muted">
        Escreva o que quebrou, o que faltou ou o que te confundiu. Vai direto para quem faz o
        Hivvo, junto com a versão do app. Se precisarmos de mais detalhes, respondemos em{' '}
        <span className="text-text-primary">{email}</span>.
      </p>

      <label className="sr-only" htmlFor="feedback-mensagem">
        Sua mensagem
      </label>
      <textarea
        id="feedback-mensagem"
        rows={4}
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value)
          if (erro) setErro('')
        }}
        placeholder="O que aconteceu?"
        aria-invalid={erro ? true : undefined}
        aria-describedby={erro ? 'feedback-erro' : undefined}
        className={`${campoClass} ${erro ? 'border-danger' : 'border-bg-border'}`}
      />

      {texto.length > AVISO_A_PARTIR_DE && (
        <p className="text-xs text-text-muted tabular-nums self-end">
          {texto.length} / {MAX_MENSAGEM}
        </p>
      )}

      {erro && (
        <div id="feedback-erro" role="alert" className="flex flex-col gap-0.5">
          <p className="text-xs text-danger">{erro}</p>
          <p className="text-xs text-text-muted">O que você escreveu continua aqui.</p>
        </div>
      )}

      {/* Duas coisas que parecem faltar e não faltam:
          1. sem rótulo "Enviando…" — o Button TROCA os children pelo spinner
             quando isLoading, então o texto alternativo nunca chegaria à tela;
          2. sem `w-auto` para encolher o botão — o `w-full` do Button vence na
             folha gerada (mesma especificidade, e o Tailwind emite w-full
             depois), então a classe seria decorativa. E largura cheia É o padrão
             desta tela: "Resetar Assistente", "Começar do zero" e "Exportar
             transações" são todos assim. */}
      <Button isLoading={enviando} onClick={handleEnviar}>
        Enviar
      </Button>
    </div>
  )
}
