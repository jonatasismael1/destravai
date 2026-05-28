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

const TOAST_STYLES: Record<ToastType, { bg: string; border: string; color: string }> = {
  success: { bg: 'rgba(83,214,161,0.12)', border: 'rgba(83,214,161,0.35)', color: '#53D6A1' },
  info: { bg: 'rgba(109,93,246,0.12)', border: 'rgba(109,93,246,0.35)', color: '#9B8CFF' },
  warning: { bg: 'rgba(247,185,85,0.12)', border: 'rgba(247,185,85,0.35)', color: '#F7B955' },
  error: { bg: 'rgba(255,122,107,0.12)', border: 'rgba(255,122,107,0.35)', color: '#FF7A6B' },
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
                background: style.bg,
                border: `1px solid ${style.border}`,
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
              }}
            >
              <span className="text-sm font-black flex-shrink-0" style={{ color: style.color }}>
                {TOAST_ICONS[toast.type]}
              </span>
              <p className="text-sm font-semibold" style={{ color: '#F0EEF8' }}>{toast.message}</p>
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
