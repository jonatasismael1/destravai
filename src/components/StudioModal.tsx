import { useState, useRef, useEffect, useCallback } from 'react'
import { X, FlipHorizontal2, Square, Download, Share2, RotateCcw, CameraOff, ChevronUp, ChevronDown, FileText, Clapperboard, Lightbulb } from 'lucide-react'
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
  { key: 'roteiro' as const, label: 'Roteiro', Icon: FileText },
  { key: 'acao' as const, label: 'Ação', Icon: Clapperboard },
  { key: 'dica' as const, label: 'Dica', Icon: Lightbulb },
]

const SAFE_TOP = 'max(env(safe-area-inset-top), 12px)'
const SAFE_BOTTOM = 'max(env(safe-area-inset-bottom), 16px)'

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
      // Não forçamos resolução fixa — pedimos só o facingMode e proporção ideal
      // de story (9:16); o navegador escolhe a melhor resolução nativa sem cropar.
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, aspectRatio: { ideal: 9 / 16 } },
        audio: true,
      }).catch(() =>
        navigator.mediaDevices.getUserMedia({ video: { facingMode: mode }, audio: true })
      )
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
      }
    }

    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const activeText = activeTab === 'roteiro'
    ? (sections.roteiro || 'Sem roteiro definido — use o contexto da ideia para improvisar.')
    : activeTab === 'acao'
    ? (sections.acao || idea.content)
    : (sections.dica || 'Seja você mesmo(a). Autenticidade converte mais do que perfeição.')

  return (
    <div
      className="fixed inset-0 z-[100] bg-black flex flex-col"
      style={{ height: '100dvh', touchAction: 'none' }}
    >
      {phase !== 'preview' ? (
        <>
          {/* ── Área da câmera (cresce, sem empurrar os controles) ── */}
          <div className="relative flex-1 min-h-0 overflow-hidden">
            {hasCamera ? (
              <video
                ref={liveVideoRef}
                autoPlay
                playsInline
                muted
                className="absolute inset-0 w-full h-full object-contain"
                style={{ transform: facing === 'user' ? 'scaleX(-1)' : 'none' }}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center flex-col gap-3" style={{ background: '#111' }}>
                <CameraOff size={48} color="rgba(255,255,255,0.3)" />
                <p className="text-white/40 text-sm text-center px-8">Câmera indisponível.<br />Você ainda pode ler o roteiro abaixo.</p>
              </div>
            )}

            {/* Top bar */}
            <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-5 pb-3"
              style={{ paddingTop: SAFE_TOP, background: 'linear-gradient(to bottom, rgba(0,0,0,0.6), transparent)' }}>
              <button onClick={handleClose} className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }} aria-label="Fechar">
                <X size={18} color="#fff" />
              </button>
              {phase === 'recording' && (
                <div className="flex items-center gap-2 px-4 py-2 rounded-full" style={{ background: 'rgba(0,0,0,0.6)' }}>
                  <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#FF4444' }} />
                  <span className="text-white font-mono font-bold text-sm">{formatTimer(timer)}</span>
                </div>
              )}
              <button onClick={flipCamera} className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }} aria-label="Virar câmera">
                <FlipHorizontal2 size={18} color="#fff" />
              </button>
            </div>

            {/* Teleprompter (durante gravação) sobreposto na parte inferior da câmera */}
            {phase === 'recording' && teleprompterText && (
              <div className="absolute left-3 right-3 bottom-3 z-10 rounded-2xl overflow-hidden"
                style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)', maxHeight: '38%' }}>
                <div style={{ transform: `translateY(-${scrollPx}px)` }}>
                  <p className="text-center font-semibold px-5 py-4 leading-relaxed"
                    style={{ color: 'rgba(255,255,255,0.96)', fontSize: 18, whiteSpace: 'pre-line' }}>
                    {teleprompterText}
                  </p>
                  <div style={{ height: 220 }} />
                </div>
              </div>
            )}
          </div>

          {/* ── Barra de controles (sempre visível) ── */}
          <div className="flex-shrink-0 px-5 pt-4" style={{ background: 'rgba(0,0,0,0.92)', paddingBottom: SAFE_BOTTOM }}>
            {phase === 'setup' ? (
              <div className="space-y-3">
                {/* Tabs */}
                <div className="flex gap-2">
                  {TABS.map(({ key, label, Icon }) => (
                    <button key={key} onClick={() => setActiveTab(key)}
                      className="flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                      style={activeTab === key
                        ? { background: '#6D5DF6', color: '#fff' }
                        : { background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.55)' }}>
                      <Icon size={13} /> {label}
                    </button>
                  ))}
                </div>
                {/* Conteúdo do roteiro */}
                <div className="rounded-2xl p-3 overflow-y-auto" style={{ background: 'rgba(255,255,255,0.06)', maxHeight: '22vh' }}>
                  <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.9)', whiteSpace: 'pre-line' }}>
                    {activeText}
                  </p>
                </div>
                {/* Botão gravar */}
                <button onClick={startRecording} disabled={!hasCamera}
                  className="w-full py-4 rounded-2xl font-extrabold text-white text-base flex items-center justify-center gap-3 transition-all active:scale-[0.98] disabled:opacity-40"
                  style={{ background: 'linear-gradient(135deg, #FF3B30, #CC2222)', boxShadow: '0 0 28px rgba(255,59,48,0.45)' }}>
                  <span className="w-4 h-4 rounded-full bg-white/90" />
                  Começar a gravar
                </button>
              </div>
            ) : (
              /* Controles de gravação */
              <div className="flex items-center justify-between">
                {/* Velocidade do teleprompter */}
                <div className="flex flex-col items-center gap-1.5 w-16">
                  <button onClick={() => setScrollSpeed(s => parseFloat((s + 0.5).toFixed(1)))}
                    className="w-9 h-9 rounded-full flex items-center justify-center active:scale-90" style={{ background: 'rgba(255,255,255,0.15)' }} aria-label="Aumentar velocidade">
                    <ChevronUp size={16} color="#fff" />
                  </button>
                  <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.45)' }}>Veloc.</span>
                  <button onClick={() => setScrollSpeed(s => Math.max(0, parseFloat((s - 0.5).toFixed(1))))}
                    className="w-9 h-9 rounded-full flex items-center justify-center active:scale-90" style={{ background: 'rgba(255,255,255,0.15)' }} aria-label="Diminuir velocidade">
                    <ChevronDown size={16} color="#fff" />
                  </button>
                </div>
                {/* Parar */}
                <button onClick={stopRecording}
                  className="w-20 h-20 rounded-full flex items-center justify-center active:scale-95"
                  style={{ background: 'rgba(255,59,48,0.9)', border: '4px solid rgba(255,255,255,0.9)', boxShadow: '0 0 32px rgba(255,59,48,0.5)' }}
                  aria-label="Parar gravação">
                  <Square size={26} fill="#fff" color="#fff" />
                </button>
                <div className="w-16" />
              </div>
            )}
          </div>
        </>
      ) : (
        /* ── PREVIEW ── */
        <>
          <div className="flex-1 min-h-0 flex items-center justify-center" style={{ background: '#000' }}>
            <video ref={reviewVideoRef} src={recordedUrl} controls playsInline className="w-full h-full object-contain" />
          </div>
          <div className="flex-shrink-0 px-5 pt-4 space-y-3" style={{ background: '#111', paddingBottom: SAFE_BOTTOM }}>
            <p className="text-white/80 text-sm font-semibold text-center truncate">{idea.theme}</p>
            <div className="flex gap-3">
              <button onClick={retake}
                className="flex-1 py-3.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.98]"
                style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.12)' }}>
                <RotateCcw size={15} /> Gravar de novo
              </button>
              <button onClick={downloadVideo}
                className="flex-1 py-3.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.98]"
                style={{ background: 'linear-gradient(135deg, #6D5DF6, #9B8CFF)', color: '#fff', boxShadow: '0 4px 20px rgba(109,93,246,0.4)' }}>
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
