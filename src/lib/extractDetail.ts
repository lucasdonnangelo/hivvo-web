// Extrai a mensagem de erro do backend (campo `detail` do FastAPI) para exibir ao
// usuário — string simples, lista de validação (pega o primeiro `.msg`), ou objeto.
// Cai num fallback genérico quando não há nada legível.
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

// Desembrulha o `detail` de um erro do axios sem precisar castar em cada call site.
export function errorDetail(err: unknown, fallback?: string): string {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
  return extractDetail(detail, fallback)
}
