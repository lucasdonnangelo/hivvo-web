import api from './api'

interface AiChatResponse {
  resposta: string
}

export const suggestCategory = async (
  descricao: string,
  categorias: string[],
): Promise<string | null> => {
  if (!descricao || !categorias.length) return null
  const now = new Date()
  try {
    const { data } = await api.post<AiChatResponse>('/ai/chat', {
      mensagem: `Dada a transação "${descricao}", responda APENAS com o nome exato de uma dessas categorias: ${categorias.join(', ')}. Nenhuma outra palavra.`,
      mes: now.getMonth() + 1,
      ano: now.getFullYear(),
    })
    const suggested = data.resposta.trim()
    return categorias.find((c) => c.toLowerCase() === suggested.toLowerCase()) ?? null
  } catch {
    return null
  }
}
