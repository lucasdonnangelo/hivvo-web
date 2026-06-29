import api from './api'
import { unwrapList } from '../lib/unwrapList'

export interface Category {
  // Categorias padrão são objetos sintéticos com id=null e is_padrao=true;
  // as custom têm id real e is_padrao=false. A resposta NÃO inclui usuario_id.
  id: number | null
  nome: string
  icone: string
  tipo: 'receita' | 'despesa'
  ativa: boolean
  is_padrao: boolean
  criado_em: string
}

export const getCategories = () =>
  api.get<Category[]>('/categories').then((r) => unwrapList<Category>(r.data))

export const createCategory = (nome: string, icone: string) =>
  api.post<Category>('/categories', { nome, icone }).then((r) => r.data)

export const deleteCategory = (id: number) =>
  api.delete(`/categories/${id}`)
