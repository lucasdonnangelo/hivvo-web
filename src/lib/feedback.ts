// Regras puras do canal de feedback — validação da mensagem e montagem do
// contexto. Puras (nada lê `window`, `navigator` nem `import.meta`) para caberem
// no vitest que existe hoje: `src/**/*.test.ts` em ambiente node, sem jsdom.
// Quem lê o browser é o componente; aqui só chegam primitivos.

// Espelha o `max_length` do FeedbackRequest (hivvo-api). Os dois PRECISAM bater:
// ver o comentário de `cortar` abaixo.
export const MAX_MENSAGEM = 4000

// Mesma frase do backend (_VAZIO em app/routers/feedback.py). Duplicada, e não
// importada de lugar nenhum, porque são repos separados — o valor de estar igual
// é o usuário ver a MESMA frase quer o clique seja barrado aqui ou lá.
export const ERRO_VAZIO = 'Escreva sua mensagem antes de enviar.'
export const ERRO_LONGA = `Mensagem longa demais — o limite é ${MAX_MENSAGEM} caracteres.`

export interface FeedbackContexto {
  rota_anterior: string | null
  versao: string
  viewport: string
  layout: 'mobile' | 'desktop'
  user_agent: string
}

/**
 * Erro a exibir inline, ou null se a mensagem serve.
 *
 * Existe para o botão nunca ficar disabled em silêncio: ele segue clicável com a
 * caixa vazia, e o clique produz ESTA frase embaixo do campo. Um botão apagado
 * não diz o que falta.
 */
export function validarMensagem(texto: string): string | null {
  const limpo = texto.trim()
  if (limpo === '') return ERRO_VAZIO
  if (limpo.length > MAX_MENSAGEM) return ERRO_LONGA
  return null
}

// Corta no limite que o schema do backend aceita. NÃO é cosmético: um campo
// acima do `max_length` volta 422 com `detail` em LISTA, e o extractDetail
// devolve o `.msg` cru do Pydantic — o usuário leria "String should have at most
// 400 characters" por causa de um user-agent comprido que ele nunca digitou.
// Cortar aqui é o que impede o defeito registrado em lib/extractDetail.ts de
// aparecer na tela por um campo que é METADADO, não conteúdo.
function cortar(valor: string, limite: number): string {
  return valor.length <= limite ? valor : valor.slice(0, limite)
}

/**
 * Monta o contexto que viaja junto da mensagem.
 *
 * Tudo aqui é metadado que o usuário NÃO digita — é o que separa "está quebrado"
 * de um relato investigável. O que ficou de fora, e por quê:
 *
 * - identidade (id/e-mail/nome): o backend tira do usuário autenticado. Mandar
 *   do browser seria forjável e, pior, redundante.
 * - timestamp do cliente: o e-mail já tem header Date e o backend tem a hora da
 *   request. O relógio do cliente é o único dos três que pode estar torto.
 * - URL completa: só o pathname, nunca query/hash — mesma regra do
 *   `_sanitizeUrl` em lib/observability.ts, cujo alvo concreto é o `?token=` do
 *   reset de senha.
 */
export function montarContexto(entrada: {
  rotaAnterior: string | null
  // `import.meta.env.VITE_APP_VERSION` chega como string|undefined: o define do
  // vite.config sempre preenche no app, mas o harness e o vitest usam outra
  // config. "desconhecida" é honesto; um `?? ''` viraria campo em branco no
  // e-mail, indistinguível de bug do formulário.
  versao: string | undefined
  largura: number
  altura: number
  dpr: number
  userAgent: string
  // Derivado do MESMO useBreakpoint('md') que o app usa para escolher entre
  // MobileLayout e DesktopLayout. Vai resolvido de propósito: recalcular o
  // breakpoint a partir da largura crua, do outro lado, é onde o erro acontece —
  // e os bugs deste app moram nesse eixo.
  isMobile: boolean
}): FeedbackContexto {
  const dpr = Math.round(entrada.dpr * 100) / 100
  return {
    rota_anterior: entrada.rotaAnterior ? cortar(entrada.rotaAnterior, 200) : null,
    versao: cortar(entrada.versao ?? 'desconhecida', 100),
    viewport: `${Math.round(entrada.largura)}x${Math.round(entrada.altura)} @${dpr}x`,
    layout: entrada.isMobile ? 'mobile' : 'desktop',
    user_agent: cortar(entrada.userAgent, 400),
  }
}
