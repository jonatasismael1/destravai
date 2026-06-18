import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  AlignCenter, AlignLeft, AlignRight, Bold, Circle, Copy, Download, ImagePlus,
  Italic, Minus, Palette, Plus, RotateCcw, Share2, SwitchCamera, Type, X,
} from 'lucide-react'

type OverlayState = {
  text: string
  x: number
  y: number
  size: number
  rotation: number
  color: string
  font: string
  align: CanvasTextAlign
  bold: boolean
  italic: boolean
  effect: TextEffect
}

type Props = {
  initialText: string
  title: string
  onClose: () => void
}

type PointerPoint = { x: number; y: number }
type GestureStart = {
  distance: number
  angle: number
  size: number
  rotation: number
  x: number
  y: number
}
type EditTool = 'text' | 'font' | 'style' | 'color' | 'effect' | null
type PhotoSize = { width: number; height: number }
type TextEffect = 'none' | 'shadow' | 'outline' | 'glow' | 'background' | 'backgroundOutline'

const SAFE_BOTTOM = 'max(env(safe-area-inset-bottom), 18px)'
const ZOOM_LEVELS = [1, 2, 3, 5]
const TEXT_SIZE_MIN = 10
const TEXT_SIZE_MAX = 96
const TEXT_SIZE_STEP = 4
const FONT_STYLESHEET_ID = 'destravai-photo-editor-fonts'
const GOOGLE_FONTS_URL = 'https://fonts.googleapis.com/css2?family=Abril+Fatface&family=Anton&family=Bebas+Neue&family=Bungee&family=Caveat:wght@700&family=Cinzel+Decorative:wght@700&family=Cormorant+Garamond:wght@700&family=Montserrat:wght@700;800&family=Oswald:wght@700&family=Pacifico&family=Playfair+Display:wght@700&family=Righteous&family=Roboto+Mono:wght@700&display=swap'
const PRIMARY_COLORS = ['#FFFFFF', '#161618', '#EF4444', '#2563EB', '#FACC15', '#22C55E']
const ADVANCED_COLORS = [
  '#F7B955', '#53D6A1', '#9B8CFF', '#FF7A6B', '#F43F5E', '#EC4899',
  '#D946EF', '#8B5CF6', '#3B82F6', '#06B6D4', '#14B8A6', '#84CC16',
  '#F97316', '#EAB308', '#A16207', '#6B7280',
]
const FONTS = [
  { label: 'Forte', value: 'Montserrat, Inter, Arial, sans-serif', weight: 800 },
  { label: 'Clean', value: 'Montserrat, Helvetica Neue, Arial, sans-serif', weight: 700 },
  { label: 'Serif', value: 'Playfair Display, Georgia, serif', weight: 700 },
  { label: 'Mono', value: 'Roboto Mono, Courier New, monospace', weight: 700 },
  { label: 'Impacto', value: 'Anton, Impact, sans-serif', weight: 700 },
  { label: 'Deco', value: 'Cinzel Decorative, Copperplate, fantasy', weight: 700 },
  { label: 'Script', value: 'Pacifico, Brush Script MT, cursive', weight: 700 },
  { label: 'Hand', value: 'Caveat, Segoe Print, cursive', weight: 700 },
  { label: 'Luxo', value: 'Cormorant Garamond, Garamond, serif', weight: 700 },
  { label: 'Cond', value: 'Oswald, Arial Narrow, sans-serif', weight: 700 },
  { label: 'Bubble', value: 'Righteous, Arial Black, sans-serif', weight: 700 },
  { label: 'Cartaz', value: 'Bebas Neue, Impact, sans-serif', weight: 700 },
  { label: 'Retro', value: 'Abril Fatface, Georgia, serif', weight: 700 },
  { label: 'Pixel', value: 'Bungee, Consolas, monospace', weight: 700 },
]

const EFFECT_OPTIONS: Array<{ id: TextEffect; label: string; description: string }> = [
  { id: 'none', label: 'Limpo', description: 'Sem sombra' },
  { id: 'shadow', label: 'Sombra', description: 'Leve' },
  { id: 'outline', label: 'Contorno', description: 'Ao redor' },
  { id: 'glow', label: 'Brilho', description: 'Luz' },
  { id: 'background', label: 'Fundo', description: 'Tarja' },
  { id: 'backgroundOutline', label: 'Fundo+', description: 'Tarja + contorno' },
]

const ALIGN_OPTIONS: Array<{ value: CanvasTextAlign; label: string; Icon: typeof AlignLeft }> = [
  { value: 'left', label: 'Alinhar a esquerda', Icon: AlignLeft },
  { value: 'center', label: 'Centralizar', Icon: AlignCenter },
  { value: 'right', label: 'Alinhar a direita', Icon: AlignRight },
]

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function isHexColor(value: string) {
  return /^#[0-9A-F]{6}$/i.test(value)
}

function pointerDistance(a: PointerPoint, b: PointerPoint) {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

function pointerAngle(a: PointerPoint, b: PointerPoint) {
  return Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI
}

function pointerMidpoint(a: PointerPoint, b: PointerPoint): PointerPoint {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

function getOutlineColor(fill: string) {
  return fill.toUpperCase() === '#161618' ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.78)'
}

function getBackgroundColor(fill: string) {
  return fill.toUpperCase() === '#161618' ? 'rgba(255,255,255,0.72)' : 'rgba(0,0,0,0.52)'
}

function hasOutline(effect: TextEffect) {
  return effect === 'outline' || effect === 'backgroundOutline'
}

function hasBackground(effect: TextEffect) {
  return effect === 'background' || effect === 'backgroundOutline'
}

function getTextShadow(effect: TextEffect, fill: string) {
  if (effect === 'none' || effect === 'background') return 'none'
  if (effect === 'glow') {
    return fill.toUpperCase() === '#161618'
      ? '0 0 7px rgba(255,255,255,0.95), 0 0 22px rgba(255,255,255,0.7)'
      : `0 0 8px ${fill}, 0 0 24px rgba(255,255,255,0.42), 0 3px 16px rgba(0,0,0,0.72)`
  }
  return fill.toUpperCase() === '#161618'
    ? '0 2px 14px rgba(255,255,255,0.68)'
    : '0 3px 18px rgba(0,0,0,0.78)'
}

function getPreviewEffectStyle(effect: TextEffect, color: string, size: number): CSSProperties {
  return {
    background: hasBackground(effect) ? getBackgroundColor(color) : undefined,
    borderRadius: hasBackground(effect) ? Math.max(8, size * 0.28) : undefined,
    padding: hasBackground(effect) ? `${Math.max(4, size * 0.16)}px ${Math.max(7, size * 0.28)}px` : undefined,
    WebkitTextStroke: hasOutline(effect) ? `${Math.max(1, size * 0.055)}px ${getOutlineColor(color)}` : undefined,
    paintOrder: hasOutline(effect) ? 'stroke fill' : undefined,
    textShadow: getTextShadow(effect, color),
  }
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.min(radius, width / 2, height / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + width - r, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + r)
  ctx.lineTo(x + width, y + height - r)
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height)
  ctx.lineTo(x + r, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function ensureEditorFonts() {
  if (typeof document === 'undefined' || document.getElementById(FONT_STYLESHEET_ID)) return

  const googlePreconnect = document.createElement('link')
  googlePreconnect.rel = 'preconnect'
  googlePreconnect.href = 'https://fonts.googleapis.com'
  document.head.appendChild(googlePreconnect)

  const gstaticPreconnect = document.createElement('link')
  gstaticPreconnect.rel = 'preconnect'
  gstaticPreconnect.href = 'https://fonts.gstatic.com'
  gstaticPreconnect.crossOrigin = 'anonymous'
  document.head.appendChild(gstaticPreconnect)

  const stylesheet = document.createElement('link')
  stylesheet.id = FONT_STYLESHEET_ID
  stylesheet.rel = 'stylesheet'
  stylesheet.href = GOOGLE_FONTS_URL
  document.head.appendChild(stylesheet)
}

function getCameraAttempts(mode: 'user' | 'environment'): MediaStreamConstraints[] {
  const facingMode = { ideal: mode }
  return [
    { video: { facingMode, height: { ideal: 1920 }, frameRate: { ideal: 30, max: 30 } }, audio: false },
    { video: { facingMode, height: { ideal: 1280 }, frameRate: { ideal: 30, max: 30 } }, audio: false },
    { video: { facingMode, frameRate: { ideal: 30, max: 30 } }, audio: false },
    { video: { facingMode }, audio: false },
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

function getPhotoSize(stream: MediaStream): PhotoSize {
  const settings = stream.getVideoTracks()[0]?.getSettings?.() ?? {}
  const sourceMin = Math.min(settings.width ?? 0, settings.height ?? 0)
  const sourceMax = Math.max(settings.width ?? 0, settings.height ?? 0)
  return sourceMin >= 900 && sourceMax >= 1200
    ? { width: 1080, height: 1920 }
    : { width: 720, height: 1280 }
}

function getTrackZoomTarget(caps: { zoom?: { min: number; max: number } }, requestedZoom: number) {
  if (!caps.zoom) return null
  const normalZoom = 1 >= caps.zoom.min && 1 <= caps.zoom.max ? 1 : caps.zoom.min
  const target = requestedZoom === 1 ? normalZoom : requestedZoom
  return Math.min(caps.zoom.max, Math.max(caps.zoom.min, target))
}

function drawCover(ctx: CanvasRenderingContext2D, image: HTMLImageElement, width: number, height: number) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight)
  const sw = width / scale
  const sh = height / scale
  const sx = (image.naturalWidth - sw) / 2
  const sy = (image.naturalHeight - sh) / 2
  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, width, height)
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = []
  for (const paragraph of text.split(/\r?\n/)) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean)
    if (!words.length) {
      lines.push('')
      continue
    }
    let line = ''
    for (const word of words) {
      const next = line ? `${line} ${word}` : word
      if (ctx.measureText(next).width > maxWidth && line) {
        lines.push(line)
        line = word
      } else {
        line = next
      }
    }
    if (line) lines.push(line)
  }
  return lines
}

async function blobFromCanvas(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Nao foi possivel gerar a imagem.')), 'image/jpeg', 0.94)
  })
}

function makeFilename(title: string) {
  const safe = title.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 40)
  return `${safe || 'destravai-foto'}.jpg`
}

export default function PhotoTextComposer({ initialText, title, onClose }: Props) {
  const liveVideoRef = useRef<HTMLVideoElement | null>(null)
  const cameraCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const stageRef = useRef<HTMLDivElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const drawFrameRef = useRef<number | null>(null)
  const zoomSupportedRef = useRef(false)
  const photoSizeRef = useRef<PhotoSize>({ width: 1080, height: 1920 })
  const pointersRef = useRef(new Map<number, PointerPoint>())
  const gestureStartRef = useRef<GestureStart | null>(null)
  const movingTextRef = useRef(false)
  const overlayRef = useRef<OverlayState | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const photoUrlRef = useRef('')

  const [cameraError, setCameraError] = useState('')
  const [facing, setFacing] = useState<'user' | 'environment'>('environment')
  const [zoom, setZoom] = useState(1)
  const [cameraSession, setCameraSession] = useState(0)
  const [photoUrl, setPhotoUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [colorCopied, setColorCopied] = useState(false)
  const [colorValue, setColorValue] = useState('#FFFFFF')
  const [showColorModal, setShowColorModal] = useState(false)
  const [activeTool, setActiveTool] = useState<EditTool>(null)
  const [overlay, setOverlay] = useState<OverlayState>({
    text: initialText.trim(),
    x: 50,
    y: 56,
    size: 16,
    rotation: 0,
    color: '#FFFFFF',
    font: FONTS[0].value,
    align: 'center',
    bold: true,
    italic: false,
    effect: 'shadow',
  })

  const activeFont = useMemo(() => FONTS.find(f => f.value === overlay.font) ?? FONTS[0], [overlay.font])

  useEffect(() => { overlayRef.current = overlay }, [overlay])

  useEffect(() => { ensureEditorFonts() }, [])

  const stopCamera = useCallback(() => {
    if (drawFrameRef.current) cancelAnimationFrame(drawFrameRef.current)
    drawFrameRef.current = null
    streamRef.current?.getTracks().forEach(track => track.stop())
    streamRef.current = null
  }, [])

  const startCamera = useCallback(async (mode: 'user' | 'environment') => {
    setCameraError('')
    setNotice('')
    stopCamera()

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Este navegador nao permite abrir a camera aqui. Use uma foto da galeria.')
      return null
    }

    try {
      const stream = await getCameraStream(mode)
      streamRef.current = stream
      photoSizeRef.current = getPhotoSize(stream)
      const track = stream.getVideoTracks()[0]
      const caps = (track?.getCapabilities?.() ?? {}) as { zoom?: { min: number; max: number } }
      zoomSupportedRef.current = !!caps.zoom
      const normalZoom = getTrackZoomTarget(caps, 1)
      if (track && normalZoom !== null) {
        try { await track.applyConstraints({ advanced: [{ zoom: normalZoom }] } as unknown as MediaTrackConstraints) } catch { /* ignore */ }
      }
      setZoom(1)
      setFacing(mode)
      if (liveVideoRef.current) {
        liveVideoRef.current.srcObject = stream
        liveVideoRef.current.muted = true
        await liveVideoRef.current.play()
      }
      setCameraSession(current => current + 1)
      return stream
    } catch {
      setCameraError('Nao consegui acessar a camera. Voce pode permitir o acesso ou escolher uma foto da galeria.')
      return null
    }
  }, [stopCamera])

  useEffect(() => {
    void startCamera('environment')
    return () => {
      stopCamera()
      if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current)
    }
  }, [startCamera, stopCamera])

  useEffect(() => {
    if (photoUrl || !streamRef.current) return

    const draw = () => {
      const video = liveVideoRef.current
      const canvas = cameraCanvasRef.current
      const ctx = canvas?.getContext('2d', { alpha: false })
      if (video && canvas && ctx) {
        const size = photoSizeRef.current
        if (canvas.width !== size.width || canvas.height !== size.height) {
          canvas.width = size.width
          canvas.height = size.height
          ctx.imageSmoothingEnabled = true
          ctx.imageSmoothingQuality = 'high'
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
  }, [cameraSession, facing, photoUrl, zoom])

  const applyZoom = async (nextZoom: number) => {
    setZoom(nextZoom)
    const track = streamRef.current?.getVideoTracks()[0]
    if (track && zoomSupportedRef.current) {
      const caps = (track.getCapabilities?.() ?? {}) as { zoom?: { min: number; max: number } }
      const target = getTrackZoomTarget(caps, nextZoom)
      if (target !== null) {
        try { await track.applyConstraints({ advanced: [{ zoom: target }] } as unknown as MediaTrackConstraints) } catch { /* ignore */ }
      }
    }
  }

  const flipCamera = () => {
    void startCamera(facing === 'user' ? 'environment' : 'user')
  }

  const setPhotoObjectUrl = (blob: Blob) => {
    if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current)
    const nextUrl = URL.createObjectURL(blob)
    photoUrlRef.current = nextUrl
    setPhotoUrl(nextUrl)
    setActiveTool(null)
    stopCamera()
  }

  const capturePhoto = async () => {
    const canvas = cameraCanvasRef.current
    if (!canvas?.width || !canvas.height) {
      setCameraError('A camera ainda nao esta pronta. Tente novamente em instantes.')
      return
    }
    setPhotoObjectUrl(await blobFromCanvas(canvas))
  }

  const handleFile = (file: File | undefined) => {
    if (!file) return
    setPhotoObjectUrl(file)
  }

  const pointerToPercent = (clientX: number, clientY: number) => {
    const rect = stageRef.current?.getBoundingClientRect()
    if (!rect) return null
    return {
      x: clamp(((clientX - rect.left) / rect.width) * 100, 8, 92),
      y: clamp(((clientY - rect.top) / rect.height) * 100, 8, 92),
    }
  }

  const moveTextTo = (clientX: number, clientY: number) => {
    const next = pointerToPercent(clientX, clientY)
    if (next) setOverlay(current => ({ ...current, ...next }))
  }

  const startGesture = () => {
    const points = Array.from(pointersRef.current.values())
    const current = overlayRef.current
    if (points.length < 2 || !current) return
    const [a, b] = points
    const mid = pointerMidpoint(a, b)
    const pos = pointerToPercent(mid.x, mid.y)
    gestureStartRef.current = {
      distance: Math.max(1, pointerDistance(a, b)),
      angle: pointerAngle(a, b),
      size: current.size,
      rotation: current.rotation,
      x: pos?.x ?? current.x,
      y: pos?.y ?? current.y,
    }
  }

  const handleStagePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('[data-editor-control="true"]')) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    const isTextPointer = !!(event.target as HTMLElement).closest('[data-text-overlay="true"]')

    if (pointersRef.current.size >= 2) {
      movingTextRef.current = true
      startGesture()
      return
    }

    movingTextRef.current = isTextPointer
    gestureStartRef.current = null
    if (isTextPointer) moveTextTo(event.clientX, event.clientY)
  }

  const handleStagePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(event.pointerId)) return
    event.preventDefault()
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    const points = Array.from(pointersRef.current.values())

    if (points.length >= 2) {
      movingTextRef.current = true
      const [a, b] = points
      const start = gestureStartRef.current
      if (!start) {
        startGesture()
        return
      }
      const dist = pointerDistance(a, b)
      const angle = pointerAngle(a, b)
      const mid = pointerMidpoint(a, b)
      const pos = pointerToPercent(mid.x, mid.y)
      setOverlay(current => ({
        ...current,
        size: clamp(Math.round(start.size * (dist / start.distance)), TEXT_SIZE_MIN, TEXT_SIZE_MAX),
        rotation: start.rotation + (angle - start.angle),
        x: pos?.x ?? start.x,
        y: pos?.y ?? start.y,
      }))
      return
    }

    if (movingTextRef.current) moveTextTo(event.clientX, event.clientY)
  }

  const handleStagePointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(event.pointerId)
    if (pointersRef.current.size >= 2) {
      startGesture()
      return
    }
    gestureStartRef.current = null
    if (pointersRef.current.size === 0) movingTextRef.current = false
  }

  const renderFinalImage = async (): Promise<Blob> => {
    if (!photoUrl) throw new Error('Nenhuma foto capturada.')
    const image = new Image()
    image.decoding = 'async'
    image.src = photoUrl
    await image.decode()

    const width = 1080
    const height = 1920
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas indisponivel.')

    drawCover(ctx, image, width, height)
    ctx.save()
    ctx.translate((overlay.x / 100) * width, (overlay.y / 100) * height)
    ctx.rotate((overlay.rotation * Math.PI) / 180)
    const fontSize = Math.round((overlay.size / 360) * width)
    const fontWeight = overlay.bold ? Math.max(800, activeFont.weight) : activeFont.weight
    ctx.font = `${overlay.italic ? 'italic ' : ''}${fontWeight} ${fontSize}px ${overlay.font}`
    try { await document.fonts?.load(ctx.font) } catch { /* fallback to loaded/system font */ }
    ctx.textAlign = overlay.align
    ctx.textBaseline = 'middle'
    ctx.lineJoin = 'round'
    const textBoxWidth = width * 0.82
    const lines = wrapLines(ctx, overlay.text, textBoxWidth)
    const lineHeight = fontSize * 1.08
    const startY = -((lines.length - 1) * lineHeight) / 2
    const drawX = overlay.align === 'left' ? -textBoxWidth / 2 : overlay.align === 'right' ? textBoxWidth / 2 : 0
    if (hasBackground(overlay.effect) && lines.length) {
      const maxLineWidth = Math.min(textBoxWidth, Math.max(...lines.map(line => ctx.measureText(line || ' ').width)))
      const padX = fontSize * 0.32
      const padY = fontSize * 0.24
      const rectWidth = maxLineWidth + padX * 2
      const rectHeight = ((lines.length - 1) * lineHeight) + fontSize + padY * 2
      const rectX = overlay.align === 'left'
        ? drawX - padX
        : overlay.align === 'right'
          ? drawX - maxLineWidth - padX
          : -rectWidth / 2
      const rectY = startY - fontSize / 2 - padY
      ctx.fillStyle = getBackgroundColor(overlay.color)
      roundedRect(ctx, rectX, rectY, rectWidth, rectHeight, fontSize * 0.28)
      ctx.fill()
    }
    ctx.strokeStyle = getOutlineColor(overlay.color)
    ctx.lineWidth = Math.max(5, fontSize * 0.08)
    ctx.shadowColor = overlay.effect === 'glow'
      ? (overlay.color.toUpperCase() === '#161618' ? 'rgba(255,255,255,0.85)' : overlay.color)
      : overlay.effect === 'shadow'
        ? 'rgba(0,0,0,0.55)'
        : 'transparent'
    ctx.shadowBlur = overlay.effect === 'glow' ? fontSize * 0.32 : overlay.effect === 'shadow' ? fontSize * 0.12 : 0
    ctx.shadowOffsetY = overlay.effect === 'shadow' ? fontSize * 0.05 : 0
    ctx.fillStyle = overlay.color
    lines.forEach((line, index) => {
      const y = startY + index * lineHeight
      if (hasOutline(overlay.effect)) ctx.strokeText(line, drawX, y)
      ctx.fillText(line, drawX, y)
    })
    ctx.restore()
    return blobFromCanvas(canvas)
  }

  const downloadBlob = (blob: Blob) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = makeFilename(title)
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1500)
  }

  const handleDownload = async () => {
    setBusy(true)
    setNotice('')
    try {
      downloadBlob(await renderFinalImage())
      setNotice('Imagem salva.')
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Nao foi possivel salvar.')
    } finally {
      setBusy(false)
    }
  }

  const handleShare = async () => {
    setBusy(true)
    setNotice('')
    try {
      const blob = await renderFinalImage()
      const file = new File([blob], makeFilename(title), { type: 'image/jpeg' })
      const canShareFiles = typeof navigator.share === 'function'
        && typeof navigator.canShare === 'function'
        && navigator.canShare({ files: [file] })
      if (canShareFiles) {
        await navigator.share({ title, files: [file] })
        setNotice('Imagem compartilhada.')
      } else {
        downloadBlob(blob)
        setNotice('Compartilhamento nativo indisponivel. Baixei a imagem para voce postar manualmente.')
      }
    } catch (err) {
      if ((err as DOMException)?.name !== 'AbortError') {
        setNotice('Nao foi possivel compartilhar. Tente salvar a imagem.')
      }
    } finally {
      setBusy(false)
    }
  }

  const retake = () => {
    if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current)
    photoUrlRef.current = ''
    setPhotoUrl('')
    setActiveTool(null)
    void startCamera(facing)
  }

  const copyColor = () => {
    navigator.clipboard.writeText(overlay.color)
    setColorCopied(true)
    setTimeout(() => setColorCopied(false), 1600)
  }

  const toggleTool = (tool: EditTool) => setActiveTool(current => current === tool ? null : tool)

  const renderToolPanel = () => {
    if (!photoUrl || !activeTool) return null
    return (
      <div className="absolute z-30 left-3 right-3 bottom-3 rounded-3xl p-3"
        data-editor-control="true"
        style={{ background: 'rgba(0,0,0,0.62)', backdropFilter: 'blur(14px)', border: '1px solid rgba(255,255,255,0.14)' }}>
        {activeTool === 'text' && (
          <>
            <button
              type="button"
              onClick={() => setActiveTool(null)}
              className="absolute right-2 top-2 w-7 h-7 rounded-full flex items-center justify-center active:scale-95"
              style={{ background: 'rgba(255,255,255,0.12)', color: '#fff' }}
              aria-label="Fechar aba"
            >
              <X size={14} />
            </button>
            <textarea
              className="w-full rounded-2xl p-3 pr-10 text-sm resize-none outline-none"
              style={{ background: 'rgba(255,255,255,0.12)', color: '#fff', border: '1px solid rgba(255,255,255,0.14)' }}
              rows={3}
              value={overlay.text}
              onChange={event => setOverlay(current => ({ ...current, text: event.target.value }))}
              autoFocus
            />
          </>
        )}
        {activeTool === 'font' && (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide" style={{ touchAction: 'pan-x' }}>
            {FONTS.map(font => {
              const active = overlay.font === font.value
              return (
                <button
                  key={font.label}
                  type="button"
                  onClick={() => setOverlay(current => ({ ...current, font: font.value }))}
                  className="h-16 min-w-[92px] rounded-2xl px-3 flex flex-col items-center justify-center active:scale-95"
                  style={active ? activeButtonStyle : inactiveButtonStyle}
                  aria-label={`Usar fonte ${font.label}`}
                >
                  <span
                    className="text-lg leading-none truncate max-w-full"
                    style={{ fontFamily: font.value, fontWeight: font.weight }}
                  >
                    {font.label}
                  </span>
                  <span className="text-[10px] mt-1 opacity-70 font-sans">Fonte</span>
                </button>
              )
            })}
          </div>
        )}
        {activeTool === 'style' && (
          <div className="grid grid-cols-5 gap-2">
            <button
              type="button"
              onClick={() => setOverlay(current => ({ ...current, bold: !current.bold }))}
              className="h-11 rounded-2xl flex items-center justify-center"
              style={overlay.bold ? activeButtonStyle : inactiveButtonStyle}
              aria-label="Negrito"
            >
              <Bold size={18} />
            </button>
            <button
              type="button"
              onClick={() => setOverlay(current => ({ ...current, italic: !current.italic }))}
              className="h-11 rounded-2xl flex items-center justify-center"
              style={overlay.italic ? activeButtonStyle : inactiveButtonStyle}
              aria-label="Italico"
            >
              <Italic size={18} />
            </button>
            {ALIGN_OPTIONS.map(({ value, label, Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setOverlay(current => ({ ...current, align: value }))}
                className="h-11 rounded-2xl flex items-center justify-center"
                style={overlay.align === value ? activeButtonStyle : inactiveButtonStyle}
                aria-label={label}
              >
                <Icon size={18} />
              </button>
            ))}
          </div>
        )}
        {activeTool === 'color' && (
          <div className="grid grid-cols-7 gap-2">
            {PRIMARY_COLORS.map(color => (
              <button
                key={color}
                type="button"
                onClick={() => {
                  setColorValue(color)
                  setOverlay(current => ({ ...current, color }))
                }}
                className="aspect-square rounded-full active:scale-90"
                style={{
                  background: color,
                  border: overlay.color === color ? '2px solid #fff' : '1px solid rgba(255,255,255,0.32)',
                  boxShadow: color === '#FFFFFF' ? 'inset 0 0 0 1px rgba(0,0,0,0.2)' : 'none',
                }}
                aria-label={`Usar cor ${color}`}
              />
            ))}
            <button
              type="button"
              onClick={() => setShowColorModal(true)}
              className="aspect-square rounded-full flex items-center justify-center active:scale-90"
              style={inactiveButtonStyle}
              aria-label="Mais cores"
            >
              <Plus size={18} />
            </button>
          </div>
        )}
        {activeTool === 'effect' && (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide" style={{ touchAction: 'pan-x' }}>
            {EFFECT_OPTIONS.map(effect => {
              const active = overlay.effect === effect.id
              const previewColor = hasBackground(effect.id) || hasOutline(effect.id) ? '#FFFFFF' : active ? '#111111' : '#FFFFFF'
              return (
                <button
                  key={effect.id}
                  type="button"
                  onClick={() => setOverlay(current => ({ ...current, effect: effect.id }))}
                  className="h-16 min-w-[98px] rounded-2xl px-3 flex flex-col items-center justify-center active:scale-95 overflow-hidden"
                  style={active ? activeButtonStyle : inactiveButtonStyle}
                  aria-label={`Usar efeito ${effect.label}`}
                >
                  <span
                    className="text-base leading-none font-black"
                    style={{
                      color: previewColor,
                      ...getPreviewEffectStyle(effect.id, previewColor, 16),
                    }}
                  >
                    Aa
                  </span>
                  <span className="text-[10px] mt-1 opacity-80 leading-none">{effect.label}</span>
                  <span className="text-[9px] mt-0.5 opacity-55 leading-none">{effect.description}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  return createPortal(
    <div className="fixed inset-0 z-[180] flex flex-col bg-black overflow-hidden" style={{ height: '100dvh', touchAction: 'none' }}>
      <div className="absolute z-40 left-4 right-4 flex items-center justify-between gap-3 pointer-events-none"
        style={{ top: 'max(env(safe-area-inset-top), 14px)' }}>
        <div className="min-w-0 pointer-events-auto">
          <p className="text-sm font-extrabold truncate text-white">Criar foto com esse texto</p>
          <p className="text-xs truncate text-white/55">{title}</p>
        </div>
        <button type="button" onClick={onClose} className="w-10 h-10 rounded-full flex items-center justify-center pointer-events-auto"
          style={{ background: 'rgba(0,0,0,0.52)' }} aria-label="Fechar">
          <X size={18} color="#fff" />
        </button>
      </div>

      <div className="flex-1 min-h-0 flex items-center justify-center">
        <div
          ref={stageRef}
          className="relative w-full h-full max-w-[480px] mx-auto overflow-hidden bg-black touch-none select-none"
          onPointerDown={photoUrl ? handleStagePointerDown : undefined}
          onPointerMove={photoUrl ? handleStagePointerMove : undefined}
          onPointerUp={photoUrl ? handleStagePointerEnd : undefined}
          onPointerCancel={photoUrl ? handleStagePointerEnd : undefined}
        >
          {!photoUrl ? (
            <>
              <video ref={liveVideoRef} className="absolute w-px h-px opacity-0 pointer-events-none" playsInline muted />
              <canvas ref={cameraCanvasRef} className="absolute inset-0 w-full h-full object-cover" />
              {cameraError && (
                <div className="absolute inset-0 z-20 flex items-center justify-center p-6 text-center" style={{ background: 'rgba(0,0,0,0.68)' }}>
                  <p className="text-sm font-semibold leading-relaxed text-white">{cameraError}</p>
                </div>
              )}
              <div className="absolute z-30 left-0 right-0 bottom-0 flex flex-col items-center gap-4 pt-4"
                style={{ paddingBottom: SAFE_BOTTOM, background: 'linear-gradient(to top, rgba(0,0,0,0.68), transparent)' }}>
                <div className="flex items-center gap-1 px-2 py-1.5 rounded-full" style={{ background: 'rgba(0,0,0,0.58)' }}>
                  {ZOOM_LEVELS.map(z => {
                    const active = zoom === z
                    return (
                      <button
                        key={z}
                        type="button"
                        onClick={() => applyZoom(z)}
                        className="rounded-full font-bold transition-all"
                        style={active
                          ? { background: '#fff', color: '#111', width: 44, height: 32, fontSize: 13 }
                          : { color: 'rgba(255,255,255,0.85)', width: 38, height: 32, fontSize: 12 }}
                      >
                        {z}x
                      </button>
                    )
                  })}
                </div>
                <div className="w-full flex items-center justify-between px-7">
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="w-14 h-14 rounded-full flex items-center justify-center active:scale-95"
                    style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.16)' }} aria-label="Abrir galeria">
                    <ImagePlus size={24} color="#fff" />
                  </button>
                  <button type="button" onClick={capturePhoto} disabled={!!cameraError}
                    className="rounded-full flex items-center justify-center active:scale-95 disabled:opacity-50"
                    style={{ width: 78, height: 78, border: '5px solid #fff', background: 'rgba(255,255,255,0.16)' }}
                    aria-label="Tirar foto">
                    <span className="w-[58px] h-[58px] rounded-full bg-white" />
                  </button>
                  <button type="button" onClick={flipCamera} className="w-14 h-14 rounded-full flex items-center justify-center active:scale-95"
                    style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.16)' }} aria-label="Virar camera">
                    <SwitchCamera size={24} color="#fff" />
                  </button>
                </div>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={event => handleFile(event.target.files?.[0])} />
            </>
          ) : (
            <>
              <img src={photoUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute z-20 left-3 top-1/2 -translate-y-1/2 flex flex-col overflow-hidden rounded-full"
                data-editor-control="true"
                style={{ background: 'rgba(0,0,0,0.42)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.14)' }}>
                <button type="button" onClick={() => setOverlay(current => ({ ...current, size: clamp(current.size + TEXT_SIZE_STEP, TEXT_SIZE_MIN, TEXT_SIZE_MAX) }))}
                  className="w-11 h-11 flex items-center justify-center text-white active:scale-95" aria-label="Aumentar texto">
                  <Plus size={18} />
                </button>
                <div className="h-px" style={{ background: 'rgba(255,255,255,0.16)' }} />
                <button type="button" onClick={() => setOverlay(current => ({ ...current, size: clamp(current.size - TEXT_SIZE_STEP, TEXT_SIZE_MIN, TEXT_SIZE_MAX) }))}
                  className="w-11 h-11 flex items-center justify-center text-white active:scale-95" aria-label="Diminuir texto">
                  <Minus size={18} />
                </button>
              </div>
              <div
                data-text-overlay="true"
                className="absolute w-[82%] leading-none cursor-grab active:cursor-grabbing touch-none"
                style={{
                  left: `${overlay.x}%`,
                  top: `${overlay.y}%`,
                  transform: `translate(-50%, -50%) rotate(${overlay.rotation}deg)`,
                  color: overlay.color,
                  fontFamily: overlay.font,
                  fontWeight: overlay.bold ? Math.max(800, activeFont.weight) : activeFont.weight,
                  fontStyle: overlay.italic ? 'italic' : 'normal',
                  fontSize: overlay.size,
                  textAlign: overlay.align as 'left' | 'center' | 'right',
                  lineHeight: 1.06,
                  whiteSpace: 'pre-wrap',
                }}
              >
                <span
                  className="inline-block max-w-full"
                  style={{
                    color: overlay.color,
                    ...getPreviewEffectStyle(overlay.effect, overlay.color, overlay.size),
                  }}
                >
                  {overlay.text || 'Texto'}
                </span>
              </div>
              <div
                className="absolute z-30 right-3 flex flex-col gap-4 items-center"
                data-editor-control="true"
                style={{ top: 'calc(max(env(safe-area-inset-top), 14px) + 72px)' }}
              >
                <IconTool active={activeTool === 'text'} onClick={() => toggleTool('text')} label="Editar texto"><Type size={23} /></IconTool>
                <IconTool active={activeTool === 'font'} onClick={() => toggleTool('font')} label="Fonte"><span className="text-lg font-black">Aa</span></IconTool>
                <IconTool active={activeTool === 'style'} onClick={() => toggleTool('style')} label="Estilo"><Bold size={22} /></IconTool>
                <IconTool active={activeTool === 'color'} onClick={() => toggleTool('color')} label="Cor"><Palette size={22} /></IconTool>
                <IconTool active={activeTool === 'effect'} onClick={() => toggleTool('effect')} label="Efeitos"><Circle size={22} /></IconTool>
              </div>
              {renderToolPanel()}
            </>
          )}
        </div>
      </div>

      {photoUrl && (
        <div className="p-4 space-y-2" style={{ borderTop: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.86)', paddingBottom: SAFE_BOTTOM }}>
          {notice && <p className="text-xs text-center font-semibold text-white/70">{notice}</p>}
          <div className="grid grid-cols-3 gap-2">
            <button type="button" onClick={retake} className="py-3 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 text-white"
              style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.12)' }} disabled={busy}>
              <RotateCcw size={15} /> Foto
            </button>
            <button type="button" onClick={handleDownload} className="py-3 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 text-white"
              style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.12)' }} disabled={busy || !overlay.text.trim()}>
              <Download size={15} /> Salvar
            </button>
            <button type="button" onClick={handleShare} className="btn-primary py-3 text-sm" disabled={busy || !overlay.text.trim()}>
              {busy ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Share2 size={15} />}
              Enviar
            </button>
          </div>
        </div>
      )}

      {showColorModal && (
        <div className="fixed inset-0 z-[190] flex flex-col justify-end" style={{ background: 'rgba(0,0,0,0.62)', backdropFilter: 'blur(8px)' }}
          onClick={event => { if (event.target === event.currentTarget) setShowColorModal(false) }}>
          <div className="rounded-t-3xl p-5 pb-8 space-y-4 max-h-[76vh] overflow-y-auto"
            style={{ background: 'var(--bg-card)', borderTop: '1px solid var(--border-color)' }}>
            <div className="flex items-center justify-between gap-3">
              <p className="font-extrabold text-sm" style={{ color: 'var(--text-primary)' }}>Cores</p>
              <button type="button" onClick={() => setShowColorModal(false)} className="premium-round-button" aria-label="Fechar cores">
                <X size={17} />
              </button>
            </div>
            <div className="grid grid-cols-6 gap-3">
              {ADVANCED_COLORS.map(color => (
                <button key={color} type="button" onClick={() => { setColorValue(color); setOverlay(current => ({ ...current, color })) }}
                  className="aspect-square rounded-full transition-transform active:scale-90"
                  style={{ background: color, border: overlay.color === color ? '2px solid var(--brand)' : '1px solid var(--border-strong)' }}
                  aria-label={`Usar cor ${color}`} />
              ))}
            </div>
            <div className="grid grid-cols-[52px_1fr_52px] gap-2">
              <input type="color" value={isHexColor(overlay.color) ? overlay.color : '#FFFFFF'} onChange={event => {
                const next = event.target.value.toUpperCase()
                setColorValue(next)
                setOverlay(current => ({ ...current, color: next }))
              }} className="w-[52px] h-[52px] rounded-2xl overflow-hidden" aria-label="Escolher cor personalizada" />
              <input className="input font-mono uppercase" value={colorValue} onChange={event => {
                const next = event.target.value.trim().toUpperCase()
                const normalized = next.startsWith('#') ? next : `#${next}`
                setColorValue(normalized)
                if (isHexColor(normalized)) setOverlay(current => ({ ...current, color: normalized }))
              }} maxLength={7} aria-label="Codigo hexadecimal da cor" />
              <button type="button" onClick={copyColor} className="rounded-2xl flex items-center justify-center transition-all active:scale-95"
                style={colorCopied
                  ? { background: 'rgba(83,214,161,0.15)', color: '#53D6A1', border: '1px solid rgba(83,214,161,0.3)' }
                  : { background: 'var(--bg-input)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}
                aria-label="Copiar cor" title="Copiar cor">
                <Copy size={17} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body,
  )
}

const activeButtonStyle = { background: '#fff', color: '#111', border: '1px solid rgba(255,255,255,0.2)' }
const inactiveButtonStyle = { background: 'rgba(255,255,255,0.12)', color: '#fff', border: '1px solid rgba(255,255,255,0.14)' }

function IconTool({ active, onClick, label, children }: { active: boolean; onClick: () => void; label: string; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={label}
      className="w-11 h-11 rounded-full flex items-center justify-center active:scale-95"
      style={active ? activeButtonStyle : { background: 'rgba(0,0,0,0.44)', color: '#fff', border: '1px solid rgba(255,255,255,0.14)', backdropFilter: 'blur(10px)' }}>
      {children}
    </button>
  )
}
