import api from './api'
import type { FeedbackContexto } from '../lib/feedback'

// O nome do campo `mensagem` é CARGA, não estética: ele casa o
// _SENSITIVE_KEY_PATTERN de lib/observability.ts:31, e é isso que mantém o texto
// do feedback fora do que vai ao Sentry. Renomear (para `texto`, `conteudo`...)
// desliga a filtragem em silêncio — nada quebra, nada avisa, e o relato do
// usuário passa a viajar junto do próximo erro. O schema do backend carrega o
// mesmo aviso.
export async function enviarFeedback(
  mensagem: string,
  contexto: FeedbackContexto,
): Promise<void> {
  await api.post('/feedback', { mensagem, contexto })
}
