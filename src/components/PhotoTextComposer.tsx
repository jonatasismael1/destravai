import { useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { AlignCenter, AlignLeft, AlignRight, Bold, Camera, Copy, Download, ImagePlus, Italic, Minus, Palette, Plus, RotateCcw, Share2, X } from 'lucide-react'

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

const COLORS = [
  '#FFFFFF', '#161618', '#EF4444', '#2563EB', '#FACC15', '#22C55E',
  '#F7B955', '#53D6A1', '#9B8CFF', '#FF7A6B',
  '#F43F5E', '#EC4899', '#D946EF', '#8B5CF6', '#3B82F6', '#06B6D4',
  '#14B8A6', '#84CC16', '#F97316', '#EAB308', '#A16207', '#6B7280',
]
const PRIMARY_COLORS = COLORS.slice(0, 6)
const ADVANCED_COLORS = COLORS.slice(6)
const FONTS = [
  { label: 'Forte', value: 'Inter, Arial, sans-serif', weight: 800 },
  { label: 'Limpa', value: 'Arial, sans-serif', weight: 700 },
  { label: 'Editorial', value: 'Georgia, serif', weight: 700 },
  { label: 'Mono', value: 'Courier New, monospace', weight: 700 },
  { label: 'Impacto', value: 'Impact, Haettenschweiler, sans-serif', weight: 700 },
  { label: 'Condensada', value: 'Arial Narrow, Arial, sans-serif', weight: 700 },
  { label: 'Leve', value: 'Trebuchet MS, Arial, sans-serif', weight: 600 },
  { label: 'Classica', value: 'Times New Roman, Times, serif', weight: 700 },
  { label: 'Luxo', value: 'Garamond, Georgia, serif', weight: 700 },
  { label: 'Humana', value: 'Verdana, Geneva, sans-serif', weight: 700 },
  { label: 'Quadrada', value: 'Tahoma, Geneva, sans-serif', weight: 700 },
  { label: 'Marcante', value: 'Arial Black, Arial, sans-serif', weight: 900 },
  { label: 'Suave', value: 'Segoe UI, Arial, sans-serif', weight: 650 },
  { label: 'Tecnica', value: 'Consolas, Monaco, monospace', weight: 700 },
]

const ALIGN_OPTIONS: Array<{ value: CanvasTextAlign; label: string; Icon: typeof AlignLeft }> = [
  { value: 'left', label: 'Alinhar a esquerda', Icon: AlignLeft },
  { value: 'center', label: 'Centralizar', Icon: AlignCenter },
  { value: 'right', label: 'Alinhar a direita', Icon: AlignRight },
]

function isHexColor(value: string) {
  return /^#[0-9A-F]{6}$/i.test(value)
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
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

function drawCover(ctx: CanvasRenderingContext2D, image: HTMLImageElement, width: number, height: number) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight)
  const sw = width / scale
  const sh = height / scale
  const sx = (image.naturalWidth - sw) / 2
  const sy = (image.naturalHeight - sh) / 2
  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, width, height)
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const paragraphs = text.split(/\r?\n/)
  const lines: string[] = []

  for (const paragraph of paragraphs) {
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
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const stageRef = useRef<HTMLDivElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const pointersRef = useRef(new Map<number, PointerPoint>())
  const gestureStartRef = useRef<GestureStart | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const photoUrlRef = useRef('')

  const [cameraError, setCameraError] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [colorCopied, setColorCopied] = useState(false)
  const [colorValue, setColorValue] = useState('#FFFFFF')
  const [showColorModal, setShowColorModal] = useState(false)
  const [overlay, setOverlay] = useState<OverlayState>({
    text: initialText.trim(),
    x: 50,
    y: 56,
    size: 32,
    rotation: 0,
    color: '#FFFFFF',
    font: FONTS[0].value,
    align: 'center',
    bold: true,
    italic: false,
  })

  const activeFont = useMemo(() => FONTS.find(f => f.value === overlay.font) ?? FONTS[0], [overlay.font])

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(track => track.stop())
    streamRef.current = null
  }

  const openCamera = async () => {
    setCameraError('')
    setNotice('')
    stopCamera()

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Este navegador nao permite abrir a camera aqui. Use uma foto da galeria.')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1080 }, height: { ideal: 1920 } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
    } catch {
      setCameraError('Nao consegui acessar a camera. Voce pode permitir o acesso ou escolher uma foto da galeria.')
    }
  }

  useEffect(() => {
    void openCamera()
    return () => {
      stopCamera()
      if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current)
    }
    // camera opens only when the composer mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setPhotoObjectUrl = (blob: Blob) => {
    if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current)
    const nextUrl = URL.createObjectURL(blob)
    photoUrlRef.current = nextUrl
    setPhotoUrl(nextUrl)
    stopCamera()
  }

  const capturePhoto = async () => {
    const video = videoRef.current
    if (!video || !video.videoWidth || !video.videoHeight) {
      setCameraError('A camera ainda nao esta pronta. Tente novamente em instantes.')
      return
    }

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    const blob = await blobFromCanvas(canvas)
    setPhotoObjectUrl(blob)
  }

  const handleFile = (file: File | undefined) => {
    if (!file) return
    setPhotoObjectUrl(file)
  }

  const pointerToPercent = (clientX: number, clientY: number) => {
    const rect = stageRef.current?.getBoundingClientRect()
    if (!rect) return null
    const x = Math.min(92, Math.max(8, ((clientX - rect.left) / rect.width) * 100))
    const y = Math.min(92, Math.max(8, ((clientY - rect.top) / rect.height) * 100))
    return { x, y }
  }

  const moveTextTo = (clientX: number, clientY: number) => {
    const next = pointerToPercent(clientX, clientY)
    if (next) setOverlay(current => ({ ...current, ...next }))
  }

  const startGesture = () => {
    const points = Array.from(pointersRef.current.values())
    if (points.length < 2) return
    const [a, b] = points
    const mid = pointerMidpoint(a, b)
    const pos = pointerToPercent(mid.x, mid.y)
    gestureStartRef.current = {
      distance: Math.max(1, pointerDistance(a, b)),
      angle: pointerAngle(a, b),
      size: overlay.size,
      rotation: overlay.rotation,
      x: pos?.x ?? overlay.x,
      y: pos?.y ?? overlay.y,
    }
  }

  const handleTextPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })

    if (pointersRef.current.size >= 2) {
      startGesture()
      return
    }

    gestureStartRef.current = null
    moveTextTo(event.clientX, event.clientY)
  }

  const handleTextPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(event.pointerId)) return
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })

    const points = Array.from(pointersRef.current.values())
    if (points.length >= 2) {
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
      const scale = dist / start.distance
      setOverlay(current => ({
        ...current,
        size: clamp(Math.round(start.size * scale), 18, 96),
        rotation: start.rotation + (angle - start.angle),
        x: pos?.x ?? start.x,
        y: pos?.y ?? start.y,
      }))
      return
    }

    moveTextTo(event.clientX, event.clientY)
  }

  const handleTextPointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(event.pointerId)
    if (pointersRef.current.size >= 2) {
      startGesture()
      return
    }
    gestureStartRef.current = null
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
    ctx.textAlign = overlay.align
    ctx.textBaseline = 'middle'
    ctx.lineJoin = 'round'
    const textBoxWidth = width * 0.82
    const lines = wrapLines(ctx, overlay.text, textBoxWidth)
    const lineHeight = fontSize * 1.08
    const startY = -((lines.length - 1) * lineHeight) / 2
    const drawX = overlay.align === 'left' ? -textBoxWidth / 2 : overlay.align === 'right' ? textBoxWidth / 2 : 0
    ctx.strokeStyle = overlay.color === '#161618' ? 'rgba(255,255,255,0.62)' : 'rgba(0,0,0,0.58)'
    ctx.lineWidth = Math.max(7, fontSize * 0.08)
    ctx.fillStyle = overlay.color
    lines.forEach((line, index) => {
      const y = startY + index * lineHeight
      ctx.strokeText(line, drawX, y)
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
    void openCamera()
  }

  const copyColor = () => {
    navigator.clipboard.writeText(overlay.color)
    setColorCopied(true)
    setTimeout(() => setColorCopied(false), 1600)
  }

  return createPortal(
    <div className="fixed inset-0 z-[180] flex flex-col" style={{ background: 'var(--bg-base)' }}>
      <div className="flex items-center justify-between gap-3 p-4" style={{ borderBottom: '1px solid var(--border-color)' }}>
        <div className="min-w-0">
          <p className="text-sm font-extrabold truncate" style={{ color: 'var(--text-primary)' }}>Criar foto com esse texto</p>
          <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{title}</p>
        </div>
        <button type="button" onClick={onClose} className="premium-round-button" aria-label="Fechar">
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
        {!photoUrl ? (
          <div className="space-y-4">
            <div className="relative mx-auto w-full max-w-sm aspect-[9/16] overflow-hidden rounded-2xl"
              style={{ background: '#0A0A0D', border: '1px solid var(--border-color)' }}>
              <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" playsInline muted />
              {cameraError && (
                <div className="absolute inset-0 flex items-center justify-center p-5 text-center" style={{ background: 'rgba(0,0,0,0.62)' }}>
                  <p className="text-sm font-semibold leading-relaxed text-white">{cameraError}</p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={capturePhoto} className="btn-primary py-3 text-sm" disabled={!!cameraError}>
                <Camera size={16} /> Tirar foto
              </button>
              <button type="button" onClick={() => fileInputRef.current?.click()} className="btn-secondary py-3 text-sm">
                <ImagePlus size={16} /> Galeria
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={event => handleFile(event.target.files?.[0])}
            />
          </div>
        ) : (
          <>
            <div
              ref={stageRef}
              className="relative mx-auto w-full max-w-sm aspect-[9/16] overflow-hidden rounded-2xl touch-none select-none"
              style={{ background: '#0A0A0D', border: '1px solid var(--border-color)' }}
            >
              <img src={photoUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 z-20 flex flex-col overflow-hidden rounded-full"
                style={{ background: 'rgba(0,0,0,0.42)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.14)' }}>
                <button
                  type="button"
                  onClick={() => setOverlay(current => ({ ...current, size: clamp(current.size + 4, 18, 96) }))}
                  className="w-11 h-11 flex items-center justify-center text-white active:scale-95"
                  aria-label="Aumentar texto"
                  title="Aumentar texto"
                >
                  <Plus size={18} />
                </button>
                <div className="h-px" style={{ background: 'rgba(255,255,255,0.16)' }} />
                <button
                  type="button"
                  onClick={() => setOverlay(current => ({ ...current, size: clamp(current.size - 4, 18, 96) }))}
                  className="w-11 h-11 flex items-center justify-center text-white active:scale-95"
                  aria-label="Diminuir texto"
                  title="Diminuir texto"
                >
                  <Minus size={18} />
                </button>
              </div>
              <div
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
                  textShadow: overlay.color === '#161618' ? '0 2px 14px rgba(255,255,255,0.68)' : '0 3px 18px rgba(0,0,0,0.78)',
                  whiteSpace: 'pre-wrap',
                }}
                onPointerDown={handleTextPointerDown}
                onPointerMove={handleTextPointerMove}
                onPointerUp={handleTextPointerEnd}
                onPointerCancel={handleTextPointerEnd}
              >
                {overlay.text || 'Texto'}
              </div>
            </div>

            <div className="app-card rounded-2xl p-4 space-y-4">
              <div>
                <label className="label">Texto</label>
                <textarea
                  className="input resize-none"
                  rows={3}
                  value={overlay.text}
                  onChange={event => setOverlay(current => ({ ...current, text: event.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Fonte</label>
                  <select
                    className="input"
                    value={overlay.font}
                    onChange={event => setOverlay(current => ({ ...current, font: event.target.value }))}
                  >
                    {FONTS.map(font => <option key={font.value} value={font.value}>{font.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Estilo</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setOverlay(current => ({ ...current, bold: !current.bold }))}
                      className="h-[46px] rounded-2xl flex items-center justify-center gap-2 font-bold transition-all active:scale-95"
                      style={overlay.bold
                        ? { background: 'var(--brand-soft)', color: 'var(--brand)', border: '1px solid var(--brand-border)' }
                        : { background: 'var(--bg-input)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}
                      aria-pressed={overlay.bold}
                    >
                      <Bold size={16} /> B
                    </button>
                    <button
                      type="button"
                      onClick={() => setOverlay(current => ({ ...current, italic: !current.italic }))}
                      className="h-[46px] rounded-2xl flex items-center justify-center gap-2 font-bold transition-all active:scale-95"
                      style={overlay.italic
                        ? { background: 'var(--brand-soft)', color: 'var(--brand)', border: '1px solid var(--brand-border)' }
                        : { background: 'var(--bg-input)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}
                      aria-pressed={overlay.italic}
                    >
                      <Italic size={16} /> I
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="label">Alinhamento</label>
                <div className="grid grid-cols-3 gap-2">
                  {ALIGN_OPTIONS.map(({ value, label, Icon }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setOverlay(current => ({ ...current, align: value }))}
                      className="h-11 rounded-2xl flex items-center justify-center transition-all active:scale-95"
                      style={overlay.align === value
                        ? { background: 'var(--brand-soft)', color: 'var(--brand)', border: '1px solid var(--brand-border)' }
                        : { background: 'var(--bg-input)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}
                      aria-label={label}
                      aria-pressed={overlay.align === value}
                    >
                      <Icon size={18} />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="label">Cor</label>
                <div className="grid grid-cols-7 gap-2">
                  {PRIMARY_COLORS.map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => {
                        setColorValue(color)
                        setOverlay(current => ({ ...current, color }))
                      }}
                      className="aspect-square rounded-full transition-transform active:scale-90"
                      style={{
                        background: color,
                        border: overlay.color === color ? '2px solid var(--brand)' : '1px solid var(--border-strong)',
                        boxShadow: color === '#FFFFFF' ? 'inset 0 0 0 1px rgba(0,0,0,0.15)' : 'none',
                      }}
                      aria-label={`Usar cor ${color}`}
                    />
                  ))}
                  <button
                    type="button"
                    onClick={() => setShowColorModal(true)}
                    className="aspect-square rounded-full flex items-center justify-center transition-transform active:scale-90"
                    style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}
                    aria-label="Mais cores"
                    title="Mais cores"
                  >
                    <Plus size={17} />
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {photoUrl && (
        <div className="p-4 space-y-2" style={{ borderTop: '1px solid var(--border-color)', background: 'var(--bg-card)' }}>
          {notice && (
            <p className="text-xs text-center font-semibold" style={{ color: 'var(--text-secondary)' }}>{notice}</p>
          )}
          <div className="grid grid-cols-3 gap-2">
            <button type="button" onClick={retake} className="btn-secondary py-3 text-sm" disabled={busy}>
              <RotateCcw size={15} /> Foto
            </button>
            <button type="button" onClick={handleDownload} className="btn-secondary py-3 text-sm" disabled={busy || !overlay.text.trim()}>
              <Download size={15} /> Salvar
            </button>
            <button type="button" onClick={handleShare} className="btn-primary py-3 text-sm" disabled={busy || !overlay.text.trim()}>
              {busy ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> </> : <Share2 size={15} />}
              Enviar
            </button>
          </div>
          <p className="text-[11px] text-center" style={{ color: 'var(--text-muted)' }}>
            Se o Instagram nao aparecer no compartilhamento, salve a imagem e poste manualmente.
          </p>
        </div>
      )}

      {showColorModal && (
        <div
          className="fixed inset-0 z-[190] flex flex-col justify-end"
          style={{ background: 'rgba(0,0,0,0.62)', backdropFilter: 'blur(8px)' }}
          onClick={event => { if (event.target === event.currentTarget) setShowColorModal(false) }}
        >
          <div className="rounded-t-3xl p-5 pb-8 space-y-4 max-h-[76vh] overflow-y-auto"
            style={{ background: 'var(--bg-card)', borderTop: '1px solid var(--border-color)' }}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-9 h-9 rounded-2xl flex items-center justify-center"
                  style={{ background: 'var(--brand-soft)', border: '1px solid var(--brand-border)' }}>
                  <Palette size={17} style={{ color: 'var(--brand)' }} />
                </div>
                <p className="font-extrabold text-sm" style={{ color: 'var(--text-primary)' }}>Cores</p>
              </div>
              <button type="button" onClick={() => setShowColorModal(false)} className="premium-round-button" aria-label="Fechar cores">
                <X size={17} />
              </button>
            </div>

            <div className="grid grid-cols-6 gap-3">
              {ADVANCED_COLORS.map(color => (
                <button
                  key={color}
                  type="button"
                  onClick={() => {
                    setColorValue(color)
                    setOverlay(current => ({ ...current, color }))
                  }}
                  className="aspect-square rounded-full transition-transform active:scale-90"
                  style={{
                    background: color,
                    border: overlay.color === color ? '2px solid var(--brand)' : '1px solid var(--border-strong)',
                  }}
                  aria-label={`Usar cor ${color}`}
                />
              ))}
            </div>

            <div className="grid grid-cols-[52px_1fr_52px] gap-2">
              <input
                type="color"
                value={isHexColor(overlay.color) ? overlay.color : '#FFFFFF'}
                onChange={event => {
                  const next = event.target.value.toUpperCase()
                  setColorValue(next)
                  setOverlay(current => ({ ...current, color: next }))
                }}
                className="w-[52px] h-[52px] rounded-2xl overflow-hidden"
                aria-label="Escolher cor personalizada"
              />
              <input
                className="input font-mono uppercase"
                value={colorValue}
                onChange={event => {
                  const next = event.target.value.trim().toUpperCase()
                  const normalized = next.startsWith('#') ? next : `#${next}`
                  setColorValue(normalized)
                  if (isHexColor(normalized)) {
                    setOverlay(current => ({ ...current, color: normalized }))
                  }
                }}
                maxLength={7}
                aria-label="Codigo hexadecimal da cor"
              />
              <button
                type="button"
                onClick={copyColor}
                className="rounded-2xl flex items-center justify-center transition-all active:scale-95"
                style={colorCopied
                  ? { background: 'rgba(83,214,161,0.15)', color: '#53D6A1', border: '1px solid rgba(83,214,161,0.3)' }
                  : { background: 'var(--bg-input)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}
                aria-label="Copiar cor"
                title="Copiar cor"
              >
                <Copy size={17} />
              </button>
            </div>
          </div>
        </div>
      )}

      {!photoUrl && (
        <div className="p-4" style={{ borderTop: '1px solid var(--border-color)', background: 'var(--bg-card)' }}>
          <p className="text-[11px] text-center" style={{ color: 'var(--text-muted)' }}>
            Se a camera nao abrir, use Galeria. O app continua funcionando sem permissao de camera.
          </p>
        </div>
      )}
    </div>,
    document.body,
  )
}
