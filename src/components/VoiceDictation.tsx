import { useState, useRef, useEffect, useCallback } from 'react'
import { Mic, MicOff, Check, X } from 'lucide-react'

interface Props {
  label?: string
  onResult: (text: string) => void
  onClose: () => void
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getSR = (): any =>
  typeof window !== 'undefined'
    ? (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition ?? null
    : null

export default function VoiceDictation({
  label = 'Fale o tema da sua ideia...',
  onResult,
  onClose,
}: Props) {
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interim, setInterim] = useState('')
  const [error, setError] = useState('')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recRef = useRef<any>(null)
  // Texto finalizado acumulado de TODAS as sessões (a verdade do transcript).
  const finalizedRef = useRef('')
  // Texto finalizado ANTES da sessão atual começar (para "continuar ditando").
  const sessionBaseRef = useRef('')
  const SR = getSR()

  const startListening = useCallback(() => {
    if (!SR) return
    // Nova sessão continua de onde a anterior parou (não zera o que já foi dito).
    sessionBaseRef.current = finalizedRef.current
    const rec = new SR()
    rec.lang = 'pt-BR'
    rec.continuous = true
    rec.interimResults = true

    rec.onstart = () => { setIsListening(true); setError('') }
    rec.onresult = (e: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      // Reconstrói o texto da SESSÃO do zero a cada evento. O e.results é
      // cumulativo dentro da sessão, então ler do índice 0 dá o texto completo
      // SEM duplicar — some com a repetição de palavras do modo contínuo.
      let sessionFinal = ''
      let interimText = ''
      for (let i = 0; i < e.results.length; i++) {
        const t = e.results[i][0].transcript
        if (e.results[i].isFinal) sessionFinal += t + ' '
        else interimText += t
      }
      finalizedRef.current = sessionBaseRef.current + sessionFinal
      setTranscript(finalizedRef.current.replace(/\s+/g, ' ').trimStart())
      setInterim(interimText)
    }
    rec.onerror = (e: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      if (e.error !== 'aborted') setError(`Microfone indisponível (${e.error})`)
      setIsListening(false)
    }
    rec.onend = () => setIsListening(false)

    recRef.current = rec
    rec.start()
    setIsListening(true)
  }, [SR]) // eslint-disable-line

  useEffect(() => {
    if (!SR) { setError('Reconhecimento de voz não suportado neste navegador.'); return }
    startListening()
    return () => recRef.current?.stop()
  }, []) // eslint-disable-line

  const stopListening = () => { recRef.current?.stop(); setIsListening(false) }

  const handleConfirm = () => {
    const full = (transcript + ' ' + interim).trim()
    if (full) onResult(full)
    onClose()
  }

  const full = (transcript + interim).trim()

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col justify-end pb-10 px-5"
      style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(12px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full space-y-5">
        {/* Mic indicator */}
        <div className="flex flex-col items-center gap-3 py-4">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300"
            style={{
              background: isListening
                ? 'linear-gradient(135deg, #FF3B30, #CC2222)'
                : 'rgba(255,255,255,0.08)',
              boxShadow: isListening ? '0 0 48px rgba(255,59,48,0.5)' : 'none',
            }}
          >
            <Mic size={36} color="#fff" />
          </div>
          <p
            className="text-sm font-bold"
            style={{ color: isListening ? '#FF6B6B' : 'rgba(255,255,255,0.45)' }}
          >
            {isListening ? 'Ouvindo...' : error || 'Microfone pausado'}
          </p>
        </div>

        {/* Live transcript */}
        <div
          className="min-h-[90px] rounded-3xl p-5"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          {full ? (
            <p className="text-white text-base leading-relaxed">
              {transcript}
              {interim && (
                <span style={{ color: 'rgba(255,255,255,0.45)' }}>{interim}</span>
              )}
            </p>
          ) : (
            <p className="text-center text-sm mt-3" style={{ color: 'rgba(255,255,255,0.3)' }}>
              {label}
            </p>
          )}
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2"
            style={{
              background: 'rgba(255,255,255,0.07)',
              color: 'rgba(255,255,255,0.55)',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <X size={15} /> Cancelar
          </button>

          {isListening ? (
            <button
              onClick={stopListening}
              className="flex-1 py-3.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2"
              style={{
                background: 'rgba(255,59,48,0.15)',
                color: '#FF6B6B',
                border: '1px solid rgba(255,59,48,0.25)',
              }}
            >
              <MicOff size={15} /> Parar
            </button>
          ) : (
            <button
              onClick={handleConfirm}
              disabled={!full}
              className="flex-1 py-3.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-35"
              style={{
                background: 'linear-gradient(135deg, #6D5DF6, #9B8CFF)',
                color: '#fff',
                boxShadow: '0 4px 20px rgba(109,93,246,0.35)',
              }}
            >
              <Check size={15} /> Usar texto
            </button>
          )}
        </div>

        {!isListening && full && (
          <button
            onClick={startListening}
            className="w-full text-center text-xs py-1"
            style={{ color: 'rgba(255,255,255,0.35)' }}
          >
            Continuar ditando
          </button>
        )}
      </div>
    </div>
  )
}
