import api from './api'

export interface Category {
  id: number
  nome: string
  icone: string
  cor: string
  ativa: boolean
  usuario_id: number | null
}

export const getCategories = () =>
  api.get<Category[]>('/categories').then((r) => r.data)

export const createCategory = (nome: string) =>
  api.post<Category>('/categories', { nome }).then((r) => r.data)

export const deleteCategory = (id: number) =>
  api.delete(`/categories/${id}`)
