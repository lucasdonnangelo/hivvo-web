import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createCategory,
  deleteCategory,
  getCategories,
} from '../services/categories'
import { useUIStore } from '../store/uiStore'

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
    staleTime: 5 * 60 * 1000,
  })
}

export function useCreateCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ nome, icone }: { nome: string; icone: string }) =>
      createCategory(nome, icone),
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
