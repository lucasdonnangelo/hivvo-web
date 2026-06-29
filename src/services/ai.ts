import api from './api'
import { unwrapList } from '../lib/unwrapList'

interface AiChatResponse {
  resposta: string
}

export interface HistoricoItem {
  role: 'user' | 'assistant'
  text: string
  created_at?: string
  sessao_id?: string
}

export const sendMessage = async (
  mensagem: string,
  mes: number,
  ano: number,
  sessaoId: string,
): Promise<string> => {
  const { data } = await api.post<AiChatResponse>('/ai/chat', { mensagem, mes, ano, sessao_id: sessaoId })
  return data.resposta
}

export const getHistorico = async (): Promise<HistoricoItem[]> => {
  const { data } = await api.get<HistoricoItem[]>('/ai/historico')
  return unwrapList<HistoricoItem>(data)
}

export const clearHistorico = async (): Promise<void> => {
  await api.delete('/ai/historico')
}

interface SuggestCategoryResponse {
  categoria: string
}

// Endpoint dedicado e stateless (FE-08): não passa por /ai/chat, não persiste
// em chat_messages nem entra na memória do Assistente. O backend monta o
// prompt com as categorias do usuário (filtradas por tipo) e garante que a
// resposta é sempre uma categoria conhecida.
export const suggestCategory = async (
  descricao: string,
  tipo: 'receita' | 'despesa',
  valor?: number,
): Promise<string | null> => {
  if (!descricao.trim()) return null
  try {
    const { data } = await api.post<SuggestCategoryResponse>('/ai/suggest-category', {
      descricao,
      tipo,
      ...(valor != null && valor > 0 ? { valor: valor.toFixed(2) } : {}),
    })
    return data.categoria
  } catch {
    return null
  }
}
