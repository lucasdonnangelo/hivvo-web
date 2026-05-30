import api from './api'

interface AiChatResponse {
  resposta: string
}

export interface HistoricoItem {
  role: 'user' | 'assistant'
  text: string
}

export const sendMessage = async (
  mensagem: string,
  mes: number,
  ano: number,
  historico: HistoricoItem[] = [],
): Promise<string> => {
  const { data } = await api.post<AiChatResponse>('/ai/chat', { mensagem, mes, ano, historico })
  return data.resposta
}

export const suggestCategory = async (
  descricao: string,
  categorias: string[],
): Promise<string | null> => {
  if (!descricao || !categorias.length) return null
  const now = new Date()
  try {
    const resposta = await sendMessage(
      `Dada a transação "${descricao}", responda APENAS com o nome exato de uma dessas categorias: ${categorias.join(', ')}. Nenhuma outra palavra.`,
      now.getMonth() + 1,
      now.getFullYear(),
    )
    const suggested = resposta.trim()
    return categorias.find((c) => c.toLowerCase() === suggested.toLowerCase()) ?? null
  } catch {
    return null
  }
}
