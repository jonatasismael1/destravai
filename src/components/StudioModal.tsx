import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  X, SlidersHorizontal, Pencil, Scan, Timer, Type,
  Zap, Sparkles, SwitchCamera, Download, Share2, RotateCcw, CameraOff, Check,
} from 'lucide-react'
import type { ContentIdea } from '../types'

interface Props {
  idea: ContentIdea
  onClose: () => void
}

type Phase = 'setup' | 'recording' | 'preview'
const ZOOM_LEVELS = [1, 2, 3, 5] as const

function parseContent(raw: string) {
  const result = { acao: '', roteiro: '', dica: '' }
  raw.split(/\n\n+/).forEach(block => {
    const t = block.trim()
    if (/^AÇ[AÃ]O\s*:/i.test(t)) result.acao = t.replace(/^AÇ[AÃ]O\s*:\s*/i, '').trim()
    else if (/^ROTEIRO|^FRASE/i.test(t)) result.roteiro = t.replace(/^[^:]+:\s*/i, '').trim()
    else if (/^DICA/i.test(t)) result.dica = t.replace(/^DICA[^:]*:\s*/i, '').trim()
  })
  if (!result.acao && !result.roteiro) result.roteiro = raw
  return result
}

function formatTimer(s: number) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

function getBestMimeType() {
  const candidates = ['video/mp4;codecs=h264,aac', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
  try { return candidates.find(t => MediaRecorder.isTypeSupported(t)) ?? '' } catch { return '' }
}

const SAFE_TOP = 'max(env(safe-area-inset-top), 16px)'
const SAFE_BOTTOM = 'max(env(safe-area-inset-bottom), 18px)'
const BRAND_REC = '#FF006E'

export default function StudioModal({ idea, onClose }: Props) {
  const [phase, setPhase] = useState<Phase>('setup')
  const [hasCamera, setHasCamera] = useState(true)
  const [facing, setFacing] = useState<'user' | 'environment'>('user')
  const [timer, setTimer] = useState(0)
  const [scrollPx, setScrollPx] = useState(0)
  const [recordedUrl, setRecordedUrl] = useState('')

  // Teleprompter
  const initial = parseContent(idea.content)
  const [script, setScript] = useState(initial.roteiro || initial.acao || '')
  const [showTeleprompter, setShowTeleprompter] = useState(true)
  const [showEditor, setShowEditor] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [fontSize, setFontSize] = useState(22)
  const [scrollSpeed, setScrollSpeed] = useState(1.2)   // px por tick (config do TEXTO)
  const [cardOpacity, setCardOpacity] = useState(0.9)

  // Câmera
  const [zoom, setZoom] = useState<number>(1)            // 1x/2x/3x/5x = ZOOM
  const [showGrid, setShowGrid] = useState(false)
  const [countdownEnabled, setCountdownEnabled] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [flashOn, setFlashOn] = useState(false)

  const liveVideoRef = useRef<HTMLVideoElement>(null)
  const reviewVideoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const blobRef = useRef<Blob | null>(null)
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const scrollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const zoomSupportedRef = useRef(false)

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }, [])

  const startCamera = useCallback(async (mode: 'user' | 'environment') => {
    stopStream()
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, aspectRatio: { ideal: 9 / 16 } },
        audio: true,
      }).catch(() => navigator.mediaDevices.getUserMedia({ video: { facingMode: mode }, audio: true }))
      streamRef.current = stream
      if (liveVideoRef.current) { liveVideoRef.current.srcObject = stream; liveVideoRef.current.muted = true }
      // Detecta suporte a zoom real da câmera
      const track = stream.getVideoTracks()[0]
      // getCapabilities/zoom não são tipados no TS padrão → cast
      const caps = (track?.getCapabilities?.() ?? {}) as { zoom?: { min: number; max: number } }
      zoomSupportedRef.current = !!caps.zoom
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

  // ── Zoom da câmera: tenta zoom real, senão fallback visual (CSS) ──
  const applyZoom = async (z: number) => {
    setZoom(z)
    const track = streamRef.current?.getVideoTracks()[0]
    if (track && zoomSupportedRef.current) {
      const caps = (track.getCapabilities?.() ?? {}) as { zoom?: { min: number; max: number } }
      if (caps.zoom) {
        const target = Math.min(caps.zoom.max, Math.max(caps.zoom.min, z))
        try { await track.applyConstraints({ advanced: [{ zoom: target }] } as unknown as MediaTrackConstraints) } catch { /* ignore */ }
      }
    }
    // Se não houver zoom real, o transform CSS abaixo aplica o zoom visual.
  }

  const toggleFlash = async () => {
    const next = !flashOn
    setFlashOn(next)
    const track = streamRef.current?.getVideoTracks()[0]
    const caps = (track?.getCapabilities?.() ?? {}) as { torch?: boolean }
    if (track && caps.torch) {
      try { await track.applyConstraints({ advanced: [{ torch: next }] } as unknown as MediaTrackConstraints) } catch { /* ignore */ }
    }
  }

  const flipCamera = () => {
    const next = facing === 'user' ? 'environment' : 'user'
    setFacing(next)
    startCamera(next)
  }

  const beginRecording = () => {
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

  // Botão principal: grava / para (com countdown opcional)
  const handleRecordPress = () => {
    if (phase === 'recording') { stopRecording(); return }
    if (!hasCamera) return
    if (countdownEnabled) {
      let n = 3
      setCountdown(n)
      const id = setInterval(() => {
        n -= 1
        if (n <= 0) { clearInterval(id); setCountdown(null); beginRecording() }
        else setCountdown(n)
      }, 1000)
    } else {
      beginRecording()
    }
  }

  const handleClose = () => { stopRecording(); stopStream(); onClose() }

  const retake = () => {
    setRecordedUrl(''); setScrollPx(0); setTimer(0); setPhase('setup'); startCamera(facing)
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
        if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: idea.theme }); return }
      } catch (err) { if ((err as Error).name === 'AbortError') return }
    }
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob); a.download = filename
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
  }

  // Transform do vídeo: espelho (frontal) + zoom visual (fallback se não houver zoom real)
  const mirror = facing === 'user' ? -1 : 1
  const cssScale = zoomSupportedRef.current ? 1 : zoom
  const videoTransform = `scaleX(${mirror * cssScale}) scaleY(${cssScale})`

  // ── PREVIEW ───────────────────────────────────────────────
  if (phase === 'preview') {
    return createPortal((
      <div className="fixed inset-0 z-[100] bg-black flex flex-col" style={{ height: '100dvh' }}>
        <div className="flex-1 min-h-0 flex items-center justify-center bg-black">
          <video ref={reviewVideoRef} src={recordedUrl} controls playsInline className="w-full h-full object-contain" />
        </div>
        <div className="flex-shrink-0 px-5 pt-4 space-y-3" style={{ background: '#111', paddingBottom: SAFE_BOTTOM }}>
          <p className="text-white/80 text-sm font-semibold text-center truncate">{idea.theme}</p>
          <div className="flex gap-3">
            <button onClick={retake} className="flex-1 py-3.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.98]"
              style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.12)' }}>
              <RotateCcw size={15} /> Regravar
            </button>
            <button onClick={downloadVideo} className="flex-1 py-3.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.98]"
              style={{ background: 'linear-gradient(135deg, #6D5DF6, #9B8CFF)', color: '#fff', boxShadow: '0 4px 20px rgba(109,93,246,0.4)' }}>
              {canShare ? <><Share2 size={15} /> Salvar na galeria</> : <><Download size={15} /> Salvar no dispositivo</>}
            </button>
          </div>
          <button onClick={handleClose} className="w-full py-2 text-xs text-center" style={{ color: 'rgba(255,255,255,0.35)' }}>
            Fechar sem salvar
          </button>
        </div>
      </div>
    ), document.body)
  }

  const recording = phase === 'recording'

  // ── CÂMERA (setup + recording) ────────────────────────────
  return createPortal((
    <div className="fixed inset-0 z-[100] bg-black overflow-hidden" style={{ height: '100dvh', touchAction: 'none' }}>
      {/* Câmera tela cheia */}
      {hasCamera ? (
        <video ref={liveVideoRef} autoPlay playsInline muted
          className="absolute inset-0 w-full h-full object-contain"
          style={{ transform: videoTransform, transition: 'transform 0.25s ease' }} />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center flex-col gap-3" style={{ background: '#111' }}>
          <CameraOff size={48} color="rgba(255,255,255,0.3)" />
          <p className="text-white/40 text-sm text-center px-8">Câmera indisponível.<br />Você ainda pode ler o roteiro.</p>
        </div>
      )}

      {/* Grade (rule of thirds) */}
      {showGrid && (
        <div className="absolute inset-0 pointer-events-none z-10">
          <div className="absolute left-1/3 top-0 bottom-0 w-px" style={{ background: 'rgba(255,255,255,0.2)' }} />
          <div className="absolute left-2/3 top-0 bottom-0 w-px" style={{ background: 'rgba(255,255,255,0.2)' }} />
          <div className="absolute top-1/3 left-0 right-0 h-px" style={{ background: 'rgba(255,255,255,0.2)' }} />
          <div className="absolute top-2/3 left-0 right-0 h-px" style={{ background: 'rgba(255,255,255,0.2)' }} />
        </div>
      )}

      {/* Botão fechar (sempre) */}
      <button onClick={handleClose}
        className="absolute z-30 w-10 h-10 rounded-full flex items-center justify-center"
        style={{ top: SAFE_TOP, right: 14, background: 'rgba(0,0,0,0.5)' }} aria-label="Fechar">
        <X size={18} color="#fff" />
      </button>

      {/* Timer durante gravação */}
      {recording && (
        <div className="absolute z-30 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-full"
          style={{ top: SAFE_TOP, background: 'rgba(0,0,0,0.6)' }}>
          <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#FF4444' }} />
          <span className="text-white font-mono font-bold text-sm">{formatTimer(timer)}</span>
        </div>
      )}

      {/* ── Card do Teleprompter (topo) ── */}
      {showTeleprompter && (
        <div className="absolute z-20 left-3 right-3 rounded-3xl overflow-hidden flex flex-col"
          style={{ top: `calc(${SAFE_TOP} + 8px)`, height: '32vh', background: `rgba(31,35,41,${cardOpacity})`, backdropFilter: 'blur(4px)' }}>
          {/* Texto / placeholder */}
          <div className="flex-1 overflow-hidden px-5 pt-5" onClick={() => !recording && setShowEditor(true)}>
            {script ? (
              <div style={{ transform: recording ? `translateY(-${scrollPx}px)` : 'none' }}>
                <p style={{ color: 'rgba(255,255,255,0.92)', fontSize, lineHeight: 1.5, whiteSpace: 'pre-line', fontWeight: 600 }}>
                  {script}
                </p>
                <div style={{ height: 240 }} />
              </div>
            ) : (
              <p style={{ color: 'rgba(255,255,255,0.45)', fontSize, fontWeight: 600 }}>Adicione seu roteiro aqui...</p>
            )}
          </div>
          {/* Rodapé do card: sliders (config) + lápis (editar) */}
          <div className="flex items-center justify-between px-4 pb-3 pt-1">
            <button onClick={() => setShowSettings(true)} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.08)' }} aria-label="Configurações do teleprompter">
              <SlidersHorizontal size={16} color="rgba(255,255,255,0.85)" />
            </button>
            <button onClick={() => setShowEditor(true)} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.08)' }} aria-label="Editar roteiro">
              <Pencil size={15} color="rgba(255,255,255,0.85)" />
            </button>
          </div>
          {/* X do card (esconder) */}
          <button onClick={() => setShowTeleprompter(false)} className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.3)' }} aria-label="Esconder teleprompter">
            <X size={16} color="rgba(255,255,255,0.9)" />
          </button>
        </div>
      )}

      {/* ── Coluna de ícones à esquerda ── */}
      {!recording && (
        <div className="absolute z-20 left-3 flex flex-col gap-5 items-center" style={{ top: '38vh' }}>
          <button onClick={() => setShowGrid(g => !g)} aria-label="Enquadramento">
            <Scan size={24} color={showGrid ? BRAND_REC : 'rgba(255,255,255,0.85)'} />
          </button>
          <button onClick={() => setCountdownEnabled(c => !c)} aria-label="Timer de contagem">
            <Timer size={24} color={countdownEnabled ? BRAND_REC : 'rgba(255,255,255,0.85)'} />
          </button>
          <span className="text-white font-extrabold text-base">{zoom}x</span>
          <button onClick={() => setShowTeleprompter(s => !s)} aria-label="Mostrar/ocultar roteiro">
            <Type size={24} color={showTeleprompter ? BRAND_REC : 'rgba(255,255,255,0.85)'} />
          </button>
        </div>
      )}

      {/* Countdown overlay */}
      {countdown !== null && (
        <div className="absolute inset-0 z-40 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.35)' }}>
          <span className="text-white font-extrabold" style={{ fontSize: 96 }}>{countdown}</span>
        </div>
      )}

      {/* ── Área inferior: zoom + controles ── */}
      <div className="absolute z-30 left-0 right-0 bottom-0 flex flex-col items-center gap-4 pt-4" style={{ paddingBottom: SAFE_BOTTOM, background: 'linear-gradient(to top, rgba(0,0,0,0.55), transparent)' }}>
        {/* Seletor de ZOOM (pílula) */}
        <div className="flex items-center gap-1 px-2 py-1.5 rounded-full" style={{ background: 'rgba(0,0,0,0.55)' }}>
          {ZOOM_LEVELS.map(z => {
            const active = zoom === z
            return (
              <button key={z} onClick={() => applyZoom(z)}
                className="rounded-full font-bold transition-all flex items-center justify-center"
                style={active
                  ? { background: '#fff', color: '#111', width: 44, height: 32, fontSize: 13 }
                  : { color: 'rgba(255,255,255,0.85)', width: 38, height: 32, fontSize: 12 }}>
                {z}x
              </button>
            )
          })}
        </div>

        {/* Linha do botão de gravar */}
        <div className="w-full flex items-center justify-between px-7">
          {/* Esquerda: flash + filtros */}
          <div className="flex items-center gap-5">
            <button onClick={toggleFlash} aria-label="Flash">
              <Zap size={24} color={flashOn ? '#FFB547' : '#fff'} fill={flashOn ? '#FFB547' : 'none'} />
            </button>
            <button aria-label="Filtros (em breve)" className="opacity-90">
              <Sparkles size={24} color="#fff" />
            </button>
          </div>

          {/* Botão central de gravação */}
          <button onClick={handleRecordPress} aria-label={recording ? 'Parar gravação' : 'Gravar'}
            className="rounded-full flex items-center justify-center active:scale-95 transition-transform"
            style={{ width: 78, height: 78, border: '5px solid #fff', background: 'transparent' }}>
            <span style={recording
              ? { width: 28, height: 28, borderRadius: 8, background: BRAND_REC }
              : { width: 60, height: 60, borderRadius: 999, background: BRAND_REC }} />
          </button>

          {/* Direita: flip + HD */}
          <div className="flex items-center gap-5">
            <button onClick={flipCamera} aria-label="Alternar câmera">
              <SwitchCamera size={24} color="#fff" />
            </button>
            <span className="text-white font-extrabold text-xs leading-none text-center">HD<br />30</span>
          </div>
        </div>
      </div>

      {/* ── Bottom sheet: editar roteiro ── */}
      {showEditor && (
        <div className="absolute inset-0 z-50 flex flex-col justify-end" style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowEditor(false) }}>
          <div className="rounded-t-3xl p-5 space-y-3" style={{ background: '#1F2329', paddingBottom: SAFE_BOTTOM }}>
            <div className="flex items-center justify-between">
              <p className="font-extrabold text-white text-base">Seu roteiro</p>
              <button onClick={() => setShowEditor(false)} className="text-white/50"><X size={18} /></button>
            </div>
            <textarea autoFocus value={script} onChange={e => setScript(e.target.value)} rows={8}
              placeholder="Cole ou digite o que você vai falar..."
              className="w-full rounded-2xl p-4 text-base resize-none outline-none"
              style={{ background: 'rgba(255,255,255,0.06)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', lineHeight: 1.5 }} />
            <button onClick={() => setShowEditor(false)}
              className="w-full py-3.5 rounded-2xl font-bold text-white flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg, #6D5DF6, #9B8CFF)' }}>
              <Check size={16} /> Pronto
            </button>
          </div>
        </div>
      )}

      {/* ── Bottom sheet: configurações do teleprompter ── */}
      {showSettings && (
        <div className="absolute inset-0 z-50 flex flex-col justify-end" style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowSettings(false) }}>
          <div className="rounded-t-3xl p-5 space-y-5" style={{ background: '#1F2329', paddingBottom: SAFE_BOTTOM }}>
            <div className="flex items-center justify-between">
              <p className="font-extrabold text-white text-base">Ajustes do teleprompter</p>
              <button onClick={() => setShowSettings(false)} className="text-white/50"><X size={18} /></button>
            </div>

            <div>
              <div className="flex justify-between mb-1.5">
                <span className="text-sm font-semibold text-white/80">Tamanho da fonte</span>
                <span className="text-sm font-bold" style={{ color: '#9B8CFF' }}>{fontSize}px</span>
              </div>
              <input type="range" min={16} max={36} step={1} value={fontSize}
                onChange={e => setFontSize(Number(e.target.value))} className="w-full" style={{ accentColor: '#7C5CFF' }} />
            </div>

            <div>
              <div className="flex justify-between mb-1.5">
                <span className="text-sm font-semibold text-white/80">Velocidade da rolagem</span>
                <span className="text-sm font-bold" style={{ color: '#9B8CFF' }}>{scrollSpeed.toFixed(1)}</span>
              </div>
              <input type="range" min={0.3} max={4} step={0.1} value={scrollSpeed}
                onChange={e => setScrollSpeed(Number(e.target.value))} className="w-full" style={{ accentColor: '#7C5CFF' }} />
              <p className="text-[11px] mt-1 text-white/40">A velocidade do texto é configurada aqui — não no seletor de zoom (1x/2x/3x/5x).</p>
            </div>

            <div>
              <div className="flex justify-between mb-1.5">
                <span className="text-sm font-semibold text-white/80">Opacidade do card</span>
                <span className="text-sm font-bold" style={{ color: '#9B8CFF' }}>{Math.round(cardOpacity * 100)}%</span>
              </div>
              <input type="range" min={0.3} max={1} step={0.05} value={cardOpacity}
                onChange={e => setCardOpacity(Number(e.target.value))} className="w-full" style={{ accentColor: '#7C5CFF' }} />
            </div>

            <button onClick={() => setShowSettings(false)}
              className="w-full py-3.5 rounded-2xl font-bold text-white" style={{ background: 'linear-gradient(135deg, #6D5DF6, #9B8CFF)' }}>
              Aplicar
            </button>
          </div>
        </div>
      )}
    </div>
  ), document.body)
}
