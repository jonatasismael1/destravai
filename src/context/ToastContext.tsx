import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

export type ToastType = 'success' | 'info' | 'warning' | 'error'

export interface Toast {
  id: string
  message: string
  type: ToastType
}

interface ToastContextType {
  toasts: Toast[]
  addToast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextType | null>(null)

const TOAST_ICONS: Record<ToastType, string> = {
  success: '✓',
  info: '✦',
  warning: '⚠',
  error: '✕',
}

// O toast fica sobre um fundo SÓLIDO (var(--bg-elevated)) com um leve tom da cor
// do tipo + borda colorida. Antes o fundo era um verde muito transparente: no
// tema claro o card sumia e o texto branco ficava ilegível. Agora o texto usa a
// cor de texto do tema (escuro no claro, claro no escuro) e o acento continua verde.
const TOAST_STYLES: Record<ToastType, { tint: string; border: string; color: string }> = {
  success: { tint: 'rgba(83,214,161,0.16)', border: 'rgba(83,214,161,0.55)', color: '#1Fae7a' },
  info: { tint: 'rgba(109,93,246,0.16)', border: 'rgba(109,93,246,0.55)', color: '#6D5DF6' },
  warning: { tint: 'rgba(247,185,85,0.18)', border: 'rgba(247,185,85,0.6)', color: '#C98A1E' },
  error: { tint: 'rgba(255,122,107,0.16)', border: 'rgba(255,122,107,0.55)', color: '#E0483A' },
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = crypto.randomUUID()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 3500)
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, addToast }}>
      {children}
      {/* Toast container */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 w-[calc(100%-2rem)] max-w-sm pointer-events-none">
        {toasts.map(toast => {
          const style = TOAST_STYLES[toast.type]
          return (
            <div
              key={toast.id}
              className="animate-fade-up flex items-center gap-3 px-4 py-3 rounded-2xl"
              style={{
                // Tom da cor sobre um fundo SÓLIDO do tema → card sempre legível.
                background: `linear-gradient(${style.tint}, ${style.tint}), var(--bg-elevated)`,
                border: `1px solid ${style.border}`,
                boxShadow: 'var(--shadow-card, 0 8px 32px rgba(0,0,0,0.4))',
              }}
            >
              <span className="text-sm font-black flex-shrink-0" style={{ color: style.color }}>
                {TOAST_ICONS[toast.type]}
              </span>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{toast.message}</p>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
