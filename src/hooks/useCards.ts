import { useQuery } from '@tanstack/react-query'
import { getCards } from '../services/cards'

export function useCards() {
  return useQuery({
    queryKey: ['cards'],
    queryFn: getCards,
    staleTime: 5 * 60 * 1000,
  })
}
