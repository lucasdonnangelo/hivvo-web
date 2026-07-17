import { create } from 'zustand'

export type ToastType = 'success' | 'error' | 'info'

interface Toast {
  id: string
  message: string
  type: ToastType
  // Tempo até o auto-dismiss, em ms. `0` = persistente (só sai no clique).
  // Sempre concreto no store; o default (3000) é aplicado no addToast.
  duration: number
}

// Na entrada, duration é opcional (default 3s) para não mexer nos toasts atuais.
type ToastInput = Omit<Toast, 'id' | 'duration'> & { duration?: number }

interface UIState {
  isLoading: boolean
  toasts: Toast[]
  activeModal: string | null
  setLoading: (loading: boolean) => void
  addToast: (toast: ToastInput) => void
  removeToast: (id: string) => void
  openModal: (name: string) => void
  closeModal: () => void
}

export const useUIStore = create<UIState>((set) => ({
  isLoading: false,
  toasts: [],
  activeModal: null,
  setLoading: (isLoading) => set({ isLoading }),
  addToast: (toast) =>
    set((state) => ({
      toasts: [
        ...state.toasts,
        { ...toast, id: crypto.randomUUID(), duration: toast.duration ?? 3000 },
      ],
    })),
  removeToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
  openModal: (activeModal) => set({ activeModal }),
  closeModal: () => set({ activeModal: null }),
}))
