import { useState, useRef, useEffect, useCallback } from 'react'
import { X, FlipHorizontal2, Square, Download, Share2, RotateCcw, CameraOff, ChevronUp, ChevronDown } from 'lucide-react'
import type { ContentIdea } from '../types'

interface Props {
  idea: ContentIdea
  onClose: () => void
}

type Phase = 'setup' | 'recording' | 'preview'

function parseContent(raw: string) {
  const result: { acao: string; roteiro: string; dica: string } = { acao: '', roteiro: '', dica: '' }
  const blocks = raw.split(/\n\n+/)
  blocks.forEach(block => {
    const trimmed = block.trim()
    if (/^AÇ[AÃ]O\s*:/i.test(trimmed))
      result.acao = trimmed.replace(/^AÇ[AÃ]O\s*:\s*/i, '').trim()
    else if (/^ROTEIRO|^FRASE/i.test(trimmed))
      result.roteiro = trimmed.replace(/^[^:]+:\s*/i, '').trim()
    else if (/^DICA/i.test(trimmed))
      result.dica = trimmed.replace(/^DICA[^:]*:\s*/i, '').trim()
  })
  if (!result.acao && !result.roteiro) result.roteiro = raw
  return result
}

function formatTimer(s: number) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

function getBestMimeType() {
  const candidates = [
    'video/mp4;codecs=h264,aac',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ]
  try {
    return candidates.find(t => MediaRecorder.isTypeSupported(t)) ?? ''
  } catch {
    return ''
  }
}

const TABS = [
  { key: 'roteiro' as const, label: '📜 Roteiro' },
  { key: 'acao' as const, label: '🎬 Ação' },
  { key: 'dica' as const, label: '💡 Dica' },
]

export default function StudioModal({ idea, onClose }: Props) {
  const [phase, setPhase] = useState<Phase>('setup')
  const [hasCamera, setHasCamera] = useState(true)
  const [facing, setFacing] = useState<'user' | 'environment'>('user')
  const [timer, setTimer] = useState(0)
  const [scrollPx, setScrollPx] = useState(0)
  const [scrollSpeed, setScrollSpeed] = useState(1.2)
  const [recordedUrl, setRecordedUrl] = useState('')
  const [activeTab, setActiveTab] = useState<'roteiro' | 'acao' | 'dica'>('roteiro')

  const liveVideoRef = useRef<HTMLVideoElement>(null)
  const reviewVideoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const blobRef = useRef<Blob | null>(null)
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const scrollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const sections = parseContent(idea.content)
  const teleprompterText = sections.roteiro || sections.acao || idea.content

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }, [])

  const startCamera = useCallback(async (mode: 'user' | 'environment') => {
    stopStream()
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, width: { ideal: 1080 }, height: { ideal: 1920 } },
        audio: true,
      })
      streamRef.current = stream
      if (liveVideoRef.current) {
        liveVideoRef.current.srcObject = stream
        liveVideoRef.current.muted = true
      }
      setHasCamera(true)
    } catch {
      setHasCamera(false)
    }
  }, [stopStream])

  useEffect(() => {
    startCamera('user')
    return () => {
      stopStream()
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
      if (scrollIntervalRef.current) clearInterval(scrollIntervalRef.current)
    }
  }, []) // eslint-disable-line

  const flipCamera = () => {
    const next: 'user' | 'environment' = facing === 'user' ? 'environment' : 'user'
    setFacing(next)
    startCamera(next)
  }

  const startRecording = () => {
    if (!streamRef.current) return
    chunksRef.current = []
    const mimeType = getBestMimeType()
    const recorder = new MediaRecorder(streamRef.current, mimeType ? { mimeType } : undefined)
    recorder.ondataavailable = e => { if (e.data?.size > 0) chunksRef.current.push(e.data) }
    recorder.onstop = () => {
      const type = chunksRef.current[0]?.type || 'video/webm'
      const blob = new Blob(chunksRef.current, { type })
      blobRef.current = blob
      setRecordedUrl(URL.createObjectURL(blob))
      stopStream()
      setPhase('preview')
    }
    recorder.start(100)
    recorderRef.current = recorder
    setPhase('recording')
    setTimer(0)
    setScrollPx(0)
    timerIntervalRef.current = setInterval(() => setTimer(t => t + 1), 1000)
    scrollIntervalRef.current = setInterval(() => setScrollPx(px => px + scrollSpeed), 50)
  }

  const stopRecording = () => {
    if (timerIntervalRef.current) { clearInterval(timerIntervalRef.current); timerIntervalRef.current = null }
    if (scrollIntervalRef.current) { clearInterval(scrollIntervalRef.current); scrollIntervalRef.current = null }
    recorderRef.current?.stop()
  }

  const handleClose = () => {
    stopRecording()
    stopStream()
    onClose()
  }

  const retake = () => {
    setRecordedUrl('')
    setScrollPx(0)
    setTimer(0)
    setPhase('setup')
    startCamera(facing)
  }

  const canShare = typeof navigator !== 'undefined' && !!navigator.share

  const downloadVideo = async () => {
    const blob = blobRef.current
    if (!blob) return
    const ext = blob.type.includes('mp4') ? 'mp4' : 'webm'
    const filename = `${idea.theme.replace(/\s+/g, '-').toLowerCase()}.${ext}`

    // iOS/Android: Web Share API abre "Salvar nos Fotos" ou apps de galeria
    if (canShare) {
      try {
        const file = new File([blob], filename, { type: blob.type })
        const shareData = { files: [file], title: idea.theme }
        if (navigator.canShare?.(shareData)) {
          await navigator.share(shareData)
          return
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        // usuário cancelou ou share falhou → fallback abaixo
      }
    }

    // Fallback: download direto
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col" style={{ touchAction: 'none' }}>

      {/* ── LIVE CAMERA (setup + recording) ───────────────────── */}
      {phase !== 'preview' && (
        <div className="relative flex-1 overflow-hidden">
          {hasCamera ? (
            <video
              ref={liveVideoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover"
              style={{ transform: facing === 'user' ? 'scaleX(-1)' : 'none' }}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center flex-col gap-3" style={{ background: '#111' }}>
              <CameraOff size={48} color="rgba(255,255,255,0.3)" />
              <p className="text-white/40 text-sm text-center px-8">Câmera indisponível.<br />Leia as instruções abaixo.</p>
            </div>
          )}

          {/* Top bar */}
          <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-5 pt-12 pb-3"
            style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.55), transparent)' }}>
            <button
              onClick={handleClose}
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(0,0,0,0.4)' }}
            >
              <X size={18} color="#fff" />
            </button>

            {phase === 'recording' && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-full" style={{ background: 'rgba(0,0,0,0.5)' }}>
                <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#FF4444' }} />
                <span className="text-white font-mono font-bold text-sm">{formatTimer(timer)}</span>
              </div>
            )}

            <button
              onClick={flipCamera}
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(0,0,0,0.4)' }}
            >
              <FlipHorizontal2 size={18} color="#fff" />
            </button>
          </div>

          {/* ── SETUP: roteiro + ação + dica ── */}
          {phase === 'setup' && (
            <div className="absolute bottom-0 left-0 right-0 z-10">
              <div
                className="rounded-t-3xl px-5 pt-4 pb-8 space-y-4"
                style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(20px)' }}
              >
                <div className="w-10 h-1 rounded-full mx-auto" style={{ background: 'rgba(255,255,255,0.3)' }} />

                {/* Tabs */}
                <div className="flex gap-2">
                  {TABS.map(tab => (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className="flex-1 py-1.5 rounded-xl text-xs font-bold transition-all"
                      style={activeTab === tab.key
                        ? { background: '#6D5DF6', color: '#fff' }
                        : { background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Content */}
                <div className="max-h-40 overflow-y-auto rounded-2xl p-3" style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.88)', whiteSpace: 'pre-line' }}>
                    {activeTab === 'roteiro'
                      ? (sections.roteiro || 'Sem roteiro definido — use o contexto da ideia para improvisar.')
                      : activeTab === 'acao'
                      ? (sections.acao || idea.content)
                      : (sections.dica || 'Seja você mesmo(a). Autenticidade converte mais do que perfeição.')}
                  </p>
                </div>

                {/* Record button */}
                <button
                  onClick={startRecording}
                  className="w-full py-4 rounded-2xl font-extrabold text-white text-base flex items-center justify-center gap-3 transition-all active:scale-[0.98]"
                  style={{
                    background: 'linear-gradient(135deg, #FF3B30, #CC2222)',
                    boxShadow: '0 0 28px rgba(255,59,48,0.45)',
                  }}
                >
                  <span className="w-4 h-4 rounded-full bg-white/90" />
                  Começar a gravar
                </button>
              </div>
            </div>
          )}

          {/* ── RECORDING: teleprompter + controls ── */}
          {phase === 'recording' && (
            <div className="absolute bottom-0 left-0 right-0 z-10">
              {/* Teleprompter */}
              {teleprompterText && (
                <div
                  className="mx-4 mb-3 rounded-2xl overflow-hidden"
                  style={{
                    background: 'rgba(0,0,0,0.55)',
                    backdropFilter: 'blur(8px)',
                    maxHeight: 180,
                  }}
                >
                  <div style={{ transform: `translateY(-${scrollPx}px)` }}>
                    <p
                      className="text-center font-semibold px-5 py-4 leading-relaxed"
                      style={{ color: 'rgba(255,255,255,0.95)', fontSize: 17, whiteSpace: 'pre-line' }}
                    >
                      {teleprompterText}
                    </p>
                    {/* Extra padding so last line still shows */}
                    <div style={{ height: 200 }} />
                  </div>
                </div>
              )}

              {/* Controls row */}
              <div
                className="flex items-center justify-between px-8 pb-12 pt-3"
                style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(16px)' }}
              >
                {/* Scroll speed */}
                <div className="flex flex-col items-center gap-2">
                  <button
                    onClick={() => setScrollSpeed(s => Math.max(0, parseFloat((s + 0.5).toFixed(1))))}
                    className="w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-90"
                    style={{ background: 'rgba(255,255,255,0.15)' }}
                  >
                    <ChevronUp size={16} color="#fff" />
                  </button>
                  <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.45)' }}>Velocidade</span>
                  <button
                    onClick={() => setScrollSpeed(s => Math.max(0, parseFloat((s - 0.5).toFixed(1))))}
                    className="w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-90"
                    style={{ background: 'rgba(255,255,255,0.15)' }}
                  >
                    <ChevronDown size={16} color="#fff" />
                  </button>
                </div>

                {/* Stop button */}
                <button
                  onClick={stopRecording}
                  className="w-20 h-20 rounded-full flex items-center justify-center transition-all active:scale-95"
                  style={{
                    background: 'rgba(255,59,48,0.85)',
                    border: '4px solid rgba(255,255,255,0.9)',
                    boxShadow: '0 0 32px rgba(255,59,48,0.5)',
                  }}
                >
                  <Square size={26} fill="#fff" color="#fff" />
                </button>

                <div className="w-12" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── PREVIEW ─────────────────────────────────────────────── */}
      {phase === 'preview' && (
        <>
          <video
            ref={reviewVideoRef}
            src={recordedUrl}
            controls
            playsInline
            className="flex-1 w-full"
            style={{ background: '#000', objectFit: 'contain' }}
          />
          <div className="px-5 pt-4 pb-10 space-y-3" style={{ background: '#111' }}>
            <p className="text-white/80 text-sm font-semibold text-center truncate">{idea.theme}</p>
            <div className="flex gap-3">
              <button
                onClick={retake}
                className="flex-1 py-3.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.12)' }}
              >
                <RotateCcw size={15} /> Gravar novamente
              </button>
              <button
                onClick={downloadVideo}
                className="flex-1 py-3.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                style={{ background: 'linear-gradient(135deg, #6D5DF6, #9B8CFF)', color: '#fff', boxShadow: '0 4px 20px rgba(109,93,246,0.4)' }}
              >
                {canShare ? <><Share2 size={15} /> Salvar na galeria</> : <><Download size={15} /> Salvar no dispositivo</>}
              </button>
            </div>
            <button onClick={handleClose} className="w-full py-2 text-xs text-center" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Fechar sem salvar
            </button>
          </div>
        </>
      )}
    </div>
  )
}
