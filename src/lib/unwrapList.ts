/**
 * Unwrap tolerante de contrato de listagem (FE-10).
 *
 * Os endpoints de lista do backend retornam HOJE um array nu (`[...]`). Quando o
 * backend migrar para o envelope paginado (`{ items: [...], total, page... }` —
 * ver Hivvo_Referencia.md §8), este helper absorve a mudança sem big-bang: os
 * services continuam tipando `T[]` e os consumidores não mudam.
 *
 * Regras (ADITIVAS e tolerantes — NUNCA lança):
 *  - já é array            -> retorna o próprio array (mesma referência);
 *  - { items: [...] }      -> retorna o array interno (envelope paginado);
 *  - { data:  [...] }      -> retorna o array interno (variante de envelope);
 *  - qualquer outra coisa  -> console.warn com a FORMA recebida + retorna [].
 *
 * Tolerância é o ponto: preferir log a throw. Lição T-37 — não barrar dado válido.
 *
 * O warn loga só METADADO (tipo/chaves/tamanho), nunca o `data` cru: os
 * chamadores são endpoints financeiros (transações, cartões, categorias...) —
 * o payload é o extrato do usuário, e devtools não é lugar pra ele. Log de
 * forma, não de conteúdo (#30).
 */
function formaDe(data: unknown): string {
  if (data === null) return 'null'
  if (Array.isArray(data)) return `array(tamanho=${data.length})`
  if (typeof data === 'object') return `object(chaves=[${Object.keys(data).join(',')}])`
  return typeof data
}

export function unwrapList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[]

  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>
    if (Array.isArray(obj.items)) return obj.items as T[]
    if (Array.isArray(obj.data)) return obj.data as T[]
  }

  console.warn(
    `[unwrapList] shape inesperado; esperava array ou {items|data: [...]}. Formato recebido: ${formaDe(data)}`,
  )
  return []
}
