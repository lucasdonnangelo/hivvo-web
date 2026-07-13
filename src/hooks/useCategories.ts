import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createCategory,
  deleteCategory,
  getCategories,
} from '../services/categories'
import { useUIStore } from '../store/uiStore'

export function useCategories(tipo?: 'receita' | 'despesa') {
  return useQuery({
    // Prefixo ['categories'] compartilhado → uma invalidação atinge todas as
    // variantes (all/despesa/receita). O sufixo separa os caches por tipo.
    queryKey: ['categories', tipo ?? 'all'],
    queryFn: () => getCategories(tipo),
    staleTime: 5 * 60 * 1000,
  })
}

export function useCreateCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      nome,
      icone,
      tipo,
    }: {
      nome: string
      icone: string
      tipo?: 'receita' | 'despesa'
    }) => createCategory(nome, icone, tipo),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] })
      useUIStore.getState().addToast({ message: 'Categoria criada', type: 'success' })
    },
  })
}

export function useDeleteCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteCategory(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] })
      useUIStore.getState().addToast({ message: 'Categoria removida', type: 'success' })
    },
  })
}
