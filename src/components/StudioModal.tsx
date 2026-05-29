import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  X, SlidersHorizontal, Pencil, Scan, Timer, Type,
  Zap, SwitchCamera, Download, Share2, RotateCcw, CameraOff, Check,
} from 'lucide-react'
import type { ContentIdea } from '../types'

interface Props {
  idea: ContentIdea
  onClose: () => void
}

type Phase = 'setup' | 'recording' | 'preview'
const ZOOM_LEVELS = [1, 2, 3, 5] as const
type RecordingSize = { width: number; height: number; videoBitsPerSecond: number }

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
  const candidates = [
    'video/mp4;codecs="avc1.42E01E,mp4a.40.2"',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ]
  try { return candidates.find(t => MediaRecorder.isTypeSupported(t)) ?? '' } catch { return '' }
}

const AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  sampleRate: { ideal: 48000 },
  channelCount: { ideal: 1 },
}

function getCameraAttempts(mode: 'user' | 'environment'): MediaStreamConstraints[] {
  const facingMode = { ideal: mode }
  const withNoBrowserCrop = (constraints: MediaTrackConstraints) => ({
    ...constraints,
    resizeMode: { ideal: 'none' },
  }) as MediaTrackConstraints
  return [
    {
      video: withNoBrowserCrop({ facingMode, width: { ideal: 1440 }, height: { ideal: 1920 }, aspectRatio: { ideal: 3 / 4 }, frameRate: { ideal: 30, max: 30 } }),
      audio: AUDIO_CONSTRAINTS,
    },
    {
      video: withNoBrowserCrop({ facingMode, width: { ideal: 1080 }, height: { ideal: 1440 }, aspectRatio: { ideal: 3 / 4 }, frameRate: { ideal: 30, max: 30 } }),
      audio: AUDIO_CONSTRAINTS,
    },
    {
      video: withNoBrowserCrop({ facingMode, width: { ideal: 1080 }, height: { ideal: 1920 }, frameRate: { ideal: 30, max: 30 } }),
      audio: AUDIO_CONSTRAINTS,
    },
    {
      video: withNoBrowserCrop({ facingMode, width: { ideal: 720 }, height: { ideal: 1280 }, frameRate: { ideal: 30, max: 30 } }),
      audio: AUDIO_CONSTRAINTS,
    },
    { video: withNoBrowserCrop({ facingMode, frameRate: { ideal: 30, max: 30 } }), audio: AUDIO_CONSTRAINTS },
    { video: withNoBrowserCrop({ facingMode, frameRate: { ideal: 30, max: 30 } }), audio: false },
  ]
}

async function getCameraStream(mode: 'user' | 'environment') {
  let lastError: unknown
  for (const constraints of getCameraAttempts(mode)) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints)
    } catch (err) {
      lastError = err
    }
  }
  throw lastError
}

function getRecordingSize(stream: MediaStream): RecordingSize {
  const settings = stream.getVideoTracks()[0]?.getSettings?.() ?? {}
  const sourceMin = Math.min(settings.width ?? 0, settings.height ?? 0)
  const sourceMax = Math.max(settings.width ?? 0, settings.height ?? 0)
  if (sourceMin >= 900 && sourceMax >= 1200) {
    return { width: 1080, height: 1920, videoBitsPerSecond: 6_000_000 }
  }
  return { width: 720, height: 1280, videoBitsPerSecond: 3_500_000 }
}

function getTrackZoomTarget(caps: { zoom?: { min: number; max: number } }, requestedZoom: number) {
  if (!caps.zoom) return null
  const normalZoom = 1 >= caps.zoom.min && 1 <= caps.zoom.max ? 1 : caps.zoom.min
  const target = requestedZoom === 1 ? normalZoom : requestedZoom
  return Math.min(caps.zoom.max, Math.max(caps.zoom.min, target))
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
  const previewCanvasRef = useRef<HTMLCanvasElement>(null)
  const reviewVideoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recordingStreamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const blobRef = useRef<Blob | null>(null)
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const scrollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const drawFrameRef = useRef<number | null>(null)
  const zoomSupportedRef = useRef(false)
  const recordingSizeRef = useRef<RecordingSize>({ width: 1080, height: 1920, videoBitsPerSecond: 6_000_000 })

  const stopStream = useCallback(() => {
    recordingStreamRef.current?.getTracks().forEach(t => t.stop())
    recordingStreamRef.current = null
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }, [])

  const startCamera = useCallback(async (mode: 'user' | 'environment') => {
    stopStream()
    try {
      const stream = await getCameraStream(mode)
      streamRef.current = stream
      recordingSizeRef.current = getRecordingSize(stream)
      if (liveVideoRef.current) { liveVideoRef.current.srcObject = stream; liveVideoRef.current.muted = true }
      // Detecta suporte a zoom real da câmera
      const track = stream.getVideoTracks()[0]
      // getCapabilities/zoom não são tipados no TS padrão → cast
      const caps = (track?.getCapabilities?.() ?? {}) as { zoom?: { min: number; max: number } }
      zoomSupportedRef.current = !!caps.zoom
      const normalZoom = getTrackZoomTarget(caps, 1)
      if (track && normalZoom !== null) {
        try { await track.applyConstraints({ advanced: [{ zoom: normalZoom }] } as unknown as MediaTrackConstraints) } catch { /* ignore */ }
      }
      setZoom(1)
      setHasCamera(true)
      return stream
    } catch {
      setHasCamera(false)
      return null
    }
  }, [stopStream])

  useEffect(() => {
    startCamera('user')
    return () => {
      stopStream()
      if (drawFrameRef.current) cancelAnimationFrame(drawFrameRef.current)
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
      if (scrollIntervalRef.current) clearInterval(scrollIntervalRef.current)
    }
  }, []) // eslint-disable-line

  // Draws the real 9:16 frame used by both preview and MediaRecorder.
  useEffect(() => {
    const video = liveVideoRef.current
    if (!video || !streamRef.current || phase === 'preview') return
    video.srcObject = streamRef.current
    video.muted = true
    video.play().catch(() => undefined)
  }, [hasCamera, phase])

  useEffect(() => {
    if (!hasCamera || phase === 'preview') return
    const draw = () => {
      const video = liveVideoRef.current
      const canvas = previewCanvasRef.current
      const ctx = canvas?.getContext('2d', { alpha: false })
      if (video && canvas && ctx) {
        const size = recordingSizeRef.current
        if (canvas.width !== size.width || canvas.height !== size.height) {
          canvas.width = size.width
          canvas.height = size.height
        }
        const vw = video.videoWidth
        const vh = video.videoHeight
        if (vw > 0 && vh > 0) {
          const cw = canvas.width
          const ch = canvas.height
          const visualZoom = zoomSupportedRef.current ? 1 : zoom
          const scale = Math.max(cw / vw, ch / vh) * visualZoom
          const dw = vw * scale
          const dh = vh * scale
          ctx.save()
          ctx.fillStyle = '#000'
          ctx.fillRect(0, 0, cw, ch)
          ctx.translate(cw / 2, ch / 2)
          if (facing === 'user') ctx.scale(-1, 1)
          ctx.drawImage(video, -dw / 2, -dh / 2, dw, dh)
          ctx.restore()
        }
      }
      drawFrameRef.current = requestAnimationFrame(draw)
    }
    drawFrameRef.current = requestAnimationFrame(draw)
    return () => {
      if (drawFrameRef.current) cancelAnimationFrame(drawFrameRef.current)
      drawFrameRef.current = null
    }
  }, [facing, hasCamera, phase, zoom])

  const applyZoom = async (z: number) => {
    setZoom(z)
    const track = streamRef.current?.getVideoTracks()[0]
    if (track && zoomSupportedRef.current) {
      const caps = (track.getCapabilities?.() ?? {}) as { zoom?: { min: number; max: number } }
      if (caps.zoom) {
        const target = getTrackZoomTarget(caps, z)
        if (target === null) return
        try { await track.applyConstraints({ advanced: [{ zoom: target }] } as unknown as MediaTrackConstraints) } catch { /* ignore */ }
      }
    }
    // If hardware zoom is unavailable, the canvas draw loop applies visual zoom.
  }

  const applyTorch = async (next: boolean, stream = streamRef.current) => {
    const track = stream?.getVideoTracks()[0]
    const caps = (track?.getCapabilities?.() ?? {}) as { torch?: boolean }
    if (!track || !caps.torch) return false
    try {
      await track.applyConstraints({ advanced: [{ torch: next }] } as unknown as MediaTrackConstraints)
      return true
    } catch {
      return false
    }
  }

  const toggleFlash = async () => {
    const next = !flashOn
    if (!next) {
      await applyTorch(false)
      setFlashOn(false)
      return
    }
    let applied = await applyTorch(true)
    if (!applied && facing !== 'environment') {
      setFacing('environment')
      const stream = await startCamera('environment')
      applied = await applyTorch(true, stream)
    }
    setFlashOn(applied)
  }

  const flipCamera = async () => {
    if (flashOn) await applyTorch(false)
    setFlashOn(false)
    const next = facing === 'user' ? 'environment' : 'user'
    setFacing(next)
    startCamera(next)
  }

  const beginRecording = () => {
    if (!streamRef.current || !previewCanvasRef.current) return
    chunksRef.current = []
    const canvas = previewCanvasRef.current
    const mimeType = getBestMimeType()
    const canvasStream = canvas.captureStream(30)
    const audioTracks = streamRef.current.getAudioTracks()
    const finalStream = new MediaStream([...canvasStream.getVideoTracks(), ...audioTracks])
    recordingStreamRef.current = finalStream
    const options: MediaRecorderOptions = {
      ...(mimeType ? { mimeType } : {}),
      videoBitsPerSecond: recordingSizeRef.current.videoBitsPerSecond,
      ...(audioTracks.length ? { audioBitsPerSecond: 128_000 } : {}),
    }
    let recorder: MediaRecorder
    try {
      recorder = new MediaRecorder(finalStream, options)
    } catch {
      // If the browser cannot encode MP4/H.264/AAC here, keep the best WebM
      // fallback. Backend ffmpeg conversion can create final MP4/AAC later.
      try {
        recorder = new MediaRecorder(finalStream, mimeType ? { mimeType } : undefined)
      } catch {
        recorder = new MediaRecorder(finalStream)
      }
    }
    recorder.ondataavailable = e => { if (e.data?.size > 0) chunksRef.current.push(e.data) }
    recorder.onstop = () => {
      const type = recorder.mimeType || chunksRef.current[0]?.type || mimeType || 'video/webm'
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
    const filename = `${idea.theme.replace(/\s+/g, '-').toLowerCase() || 'destravai-video'}.${ext}`
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

  // ── PREVIEW ───────────────────────────────────────────────
  if (phase === 'preview') {
    return createPortal((
      <div className="fixed inset-0 z-[100] bg-black flex flex-col" style={{ height: '100dvh' }}>
        <div className="flex-1 min-h-0 flex items-center justify-center bg-black">
          <video ref={reviewVideoRef} src={recordedUrl} controls playsInline className="w-full h-full object-cover" />
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
        <>
          <video ref={liveVideoRef} autoPlay playsInline muted className="absolute w-px h-px opacity-0 pointer-events-none" />
          <canvas ref={previewCanvasRef} className="absolute inset-0 w-full h-full object-cover" />
        </>
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
          {/* Esquerda: flash */}
          <div className="flex items-center gap-5 w-14">
            <button onClick={toggleFlash} aria-label="Flash">
              <Zap size={24} color={flashOn ? '#FFB547' : '#fff'} fill={flashOn ? '#FFB547' : 'none'} />
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

          {/* Direita: flip */}
          <div className="flex items-center justify-end gap-5 w-14">
            <button onClick={flipCamera} aria-label="Alternar câmera">
              <SwitchCamera size={24} color="#fff" />
            </button>
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
