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
 *  - qualquer outra coisa  -> console.warn com o shape recebido + retorna [].
 *
 * Tolerância é o ponto: preferir log a throw. Lição T-37 — não barrar dado válido.
 */
export function unwrapList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[]

  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>
    if (Array.isArray(obj.items)) return obj.items as T[]
    if (Array.isArray(obj.data)) return obj.data as T[]
  }

  console.warn('[unwrapList] shape inesperado; esperava array ou {items|data: [...]}. Recebido:', data)
  return []
}
