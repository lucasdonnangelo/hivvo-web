// Extrai a mensagem de erro do backend (campo `detail` do FastAPI) para exibir ao
// usuário — string simples, lista de validação (pega o primeiro `.msg`), ou objeto.
// Cai num fallback genérico quando não há nada legível.
//
// ⚠️ DEFEITO CONHECIDO, NÃO CONSERTADO AQUI (registrado de propósito): o ramo da
// LISTA — o formato do 422 do Pydantic — devolve o `.msg` CRU do backend. Isso
// chega ao usuário em inglês ("String should have at most 4000 characters") e,
// quando o erro vem de um validador próprio, com o prefixo "Value error, "
// colado na frente. É irmão do problema do 429 tratado abaixo: mensagem de
// máquina exibida como se fosse cópia de produto.
//
// Não foi corrigido junto porque o BLAST RADIUS é outro. O 429 é aditivo — hoje
// cai no fallback genérico da tela, então tratá-lo não muda nenhuma mensagem que
// alguém já tenha revisado. Mexer no ramo da lista ALTERARIA texto de erro em
// telas de cadastro, cartão e importação que ninguém revisou nesta leva. É por
// causa deste mesmo defeito que o POST /feedback rejeita corpo vazio com 400 no
// handler em vez de `min_length` no schema: o 400 devolve string limpa e não
// passa por aqui.
export function extractDetail(detail: unknown, fallback = 'Algo deu errado. Tente novamente.'): string {
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0]
    if (first && typeof first === 'object' && 'msg' in first) {
      return String((first as { msg: unknown }).msg)
    }
    return String(first)
  }
  if (detail && typeof detail === 'object') return JSON.stringify(detail)
  return fallback
}

// Cópia padrão do 429. Genérica de propósito: vale para qualquer endpoint com
// limite, e a tela que quiser dizer algo mais específico passa a sua.
export const ERRO_LIMITE = 'Muitas tentativas. Aguarde alguns minutos e tente de novo.'

// Desembrulha o `detail` de um erro do axios sem precisar castar em cada call site.
//
// O 429 é tratado AQUI, e não em cada tela, porque o defeito não é de nenhuma
// delas: o slowapi responde `{"error": "Rate limit exceeded: ..."}` — a chave é
// `error`, não `detail` —, então a busca por `detail` acha undefined e a tela
// mostra o seu fallback genérico ("Não foi possível importar o extrato"), que
// mente sobre o que aconteceu. Isso vale para TODO endpoint limitado: auth
// (5-10/min), /ai/chat e as duas importações já estão nessa situação hoje.
// Consertar dentro de uma tela consertaria a instância e deixaria a fonte de pé
// para o próximo endpoint que ganhar limite.
//
// Ler o status e não a chave `error`: `error` é formato interno do slowapi e
// muda com a versão; 429 é o contrato HTTP.
export function errorDetail(err: unknown, fallback?: string, limite: string = ERRO_LIMITE): string {
  const response = (err as { response?: { status?: number; data?: { detail?: unknown } } })?.response
  if (response?.status === 429) return limite
  return extractDetail(response?.data?.detail, fallback)
}
