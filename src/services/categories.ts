import api from './api'

export interface Category {
  id: number
  nome: string
  icone: string
  cor: string
  ativa: boolean
}

export const getCategories = () =>
  api.get<Category[]>('/categories').then((r) => r.data)
