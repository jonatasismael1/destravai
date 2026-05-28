import { useEffect, useState } from 'react'
import { Download, X, Share } from 'lucide-react'

// Evento beforeinstallprompt não é tipado por padrão no TS
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'destravai-install-dismissed'

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent)
}

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [show, setShow] = useState(false)
  const [iosHint, setIosHint] = useState(false)

  useEffect(() => {
    // Já instalado ou já dispensado → não mostra
    if (isStandalone() || localStorage.getItem(DISMISS_KEY)) return

    // Android / Chrome desktop: captura o evento nativo
    const onBeforeInstall = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
      setShow(true)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)

    // iOS não dispara beforeinstallprompt — mostramos instruções manuais
    if (isIOS()) {
      const t = setTimeout(() => { setIosHint(true); setShow(true) }, 2500)
      return () => { clearTimeout(t); window.removeEventListener('beforeinstallprompt', onBeforeInstall) }
    }

    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall)
  }, [])

  const handleInstall = async () => {
    if (!deferred) return
    await deferred.prompt()
    const { outcome } = await deferred.userChoice
    if (outcome === 'accepted') setShow(false)
    setDeferred(null)
  }

  const dismiss = () => {
    setShow(false)
    localStorage.setItem(DISMISS_KEY, '1')
  }

  if (!show) return null

  return (
    <div
      className="fixed left-3 right-3 z-[200] animate-fade-up"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}
    >
      <div
        className="mx-auto max-w-md rounded-3xl p-4 flex items-center gap-3"
        style={{
          background: 'rgba(23,23,36,0.96)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(124,92,255,0.3)',
          boxShadow: '0 8px 40px rgba(0,0,0,0.5), 0 0 32px rgba(124,92,255,0.15)',
        }}
      >
        <img src="/destravai-icone.png" alt="Destravaí" className="w-11 h-11 rounded-2xl flex-shrink-0" />

        <div className="flex-1 min-w-0">
          <p className="font-extrabold text-sm" style={{ color: '#F7F4FF' }}>
            Instalar o Destravaí
          </p>
          {iosHint ? (
            <p className="text-xs leading-snug mt-0.5 flex items-center gap-1 flex-wrap" style={{ color: 'rgba(247,244,255,0.6)' }}>
              Toque em <Share size={12} style={{ display: 'inline' }} /> e depois em "Adicionar à Tela de Início"
            </p>
          ) : (
            <p className="text-xs mt-0.5" style={{ color: 'rgba(247,244,255,0.6)' }}>
              Acesso rápido na tela inicial, como um app de verdade.
            </p>
          )}
        </div>

        {!iosHint && (
          <button
            onClick={handleInstall}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl font-bold text-sm text-white flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #7C5CFF, #A78BFA)', boxShadow: '0 0 16px rgba(124,92,255,0.4)' }}
          >
            <Download size={15} /> Instalar
          </button>
        )}

        <button
          onClick={dismiss}
          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(247,244,255,0.5)' }}
          aria-label="Dispensar"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  )
}
