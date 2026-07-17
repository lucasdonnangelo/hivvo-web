import { useEffect, useState } from 'react'
import { useUIStore, type ToastType } from '../../store/uiStore'
import { useBreakpoint } from '../../hooks/useBreakpoint'

const ICONS: Record<ToastType, string> = {
  success: '✓',
  error: '!',
  info: 'i',
}

const STYLES: Record<ToastType, string> = {
  success: 'bg-success/10 border-success/30 text-success',
  error: 'bg-danger/10 border-danger/30 text-danger',
  info: 'bg-amber/10 border-amber/30 text-amber',
}

function ToastItem({
  id,
  message,
  type,
  duration,
}: {
  id: string
  message: string
  type: ToastType
  duration: number
}) {
  const removeToast = useUIStore((s) => s.removeToast)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const enter = setTimeout(() => setVisible(true), 10)
    // duration === 0 → persistente: entra e fica; só sai no clique (dismiss).
    if (duration === 0) return () => clearTimeout(enter)
    // Mantém a folga de 300ms entre iniciar o fade e remover do DOM.
    const exit = setTimeout(() => setVisible(false), duration - 300)
    const remove = setTimeout(() => removeToast(id), duration)
    return () => {
      clearTimeout(enter)
      clearTimeout(exit)
      clearTimeout(remove)
    }
  }, [id, duration, removeToast])

  function dismiss() {
    setVisible(false)
    setTimeout(() => removeToast(id), 300)
  }

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-lg border text-sm font-medium shadow-lg
        transition-all duration-300 ${STYLES[type]}
        ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
    >
      <span className="w-4 text-center shrink-0 font-bold">{ICONS[type]}</span>
      <span className="flex-1">{message}</span>
      <button
        onClick={dismiss}
        className="shrink-0 opacity-50 hover:opacity-100 transition-opacity leading-none"
        aria-label="Fechar"
      >
        ×
      </button>
    </div>
  )
}

export default function ToastContainer() {
  const toasts = useUIStore((s) => s.toasts)
  const isMobile = useBreakpoint('md')

  if (toasts.length === 0) return null

  return (
    <div
      className={`fixed z-[9999] flex flex-col gap-2 pointer-events-none ${
        isMobile ? 'bottom-24 left-4 right-4' : 'top-4 right-4 w-80'
      }`}
    >
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem {...toast} />
        </div>
      ))}
    </div>
  )
}
