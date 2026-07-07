import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Preferência de UI do Dashboard (Fase 3b): qual leitura o card/donut mostram.
//  - 'fluxo'   → regime de competência ("A pagar"): topo do /statistics/monthly.
//  - 'consumo' → regime de caixa ("Gasto"): campos consumo/categorias_consumo.
// É pura preferência de UI (não é server-state) — mora em Zustand, nunca TanStack.
export type DashboardView = 'fluxo' | 'consumo'

interface DashboardState {
  view: DashboardView
  setView: (view: DashboardView) => void
}

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set) => ({
      view: 'fluxo',
      setView: (view) => set({ view }),
    }),
    { name: 'hivvo-dashboard-view' },
  ),
)
