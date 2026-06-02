import { useQuery } from '@tanstack/react-query'
import { getInstallments } from '../services/installments'

export function useInstallments(mes: number, ano: number) {
  return useQuery({
    queryKey: ['installments', mes, ano],
    queryFn: () => getInstallments({ mes, ano, cancelado: false }),
    staleTime: 2 * 60 * 1000,
  })
}

export function useUpcomingInstallments() {
  return useQuery({
    queryKey: ['installments', 'upcoming'],
    queryFn: () => getInstallments({ pago: false, cancelado: false }),
    staleTime: 2 * 60 * 1000,
  })
}
