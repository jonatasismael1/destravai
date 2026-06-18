import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  X, SlidersHorizontal, Pencil, Scan, Timer, Type, AlignCenter, AlignLeft, AlignRight,
  Zap, SwitchCamera, Download, Share2, RotateCcw, CameraOff, Check, Loader2,
  Bold, Italic, Palette, Circle, Plus, Minus,
} from 'lucide-react'
import type { ContentIdea } from '../types'
import { trackEvent } from '../services/eventsService'
import { fixMp4Duration } from '../lib/fixMp4Duration'
import { useScreenTour } from '../context/OnboardingContext'
import { useToast } from '../context/ToastContext'

interface Props {
  idea: ContentIdea
  onClose: () => void
}

type Phase = 'setup' | 'recording' | 'preview'
const ZOOM_LEVELS = [1, 2, 3, 5] as const
type RecordingSize = { width: number; height: number; videoBitsPerSecond: number }
type RecordingCodec = 'compatible' | 'hevc'
type PointerPoint = { x: number; y: number }
type VideoTextEffect = 'none' | 'shadow' | 'outline' | 'glow' | 'background' | 'backgroundOutline'
type VideoEditTool = 'text' | 'font' | 'style' | 'color' | 'effect' | null
type VideoOverlayState = {
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
  effect: VideoTextEffect
}
type VideoGestureStart = {
  distance: number
  angle: number
  size: number
  rotation: number
  x: number
  y: number
}

const VIDEO_TEXT_SIZE_MIN = 10
const VIDEO_TEXT_SIZE_MAX = 96
const VIDEO_TEXT_SIZE_STEP = 4
const FONT_STYLESHEET_ID = 'destravai-photo-editor-fonts'
const GOOGLE_FONTS_URL = 'https://fonts.googleapis.com/css2?family=Abril+Fatface&family=Anton&family=Bebas+Neue&family=Bungee&family=Caveat:wght@700&family=Cinzel+Decorative:wght@700&family=Cormorant+Garamond:wght@700&family=Montserrat:wght@700;800&family=Oswald:wght@700&family=Pacifico&family=Playfair+Display:wght@700&family=Righteous&family=Roboto+Mono:wght@700&display=swap'
const VIDEO_PRIMARY_COLORS = ['#FFFFFF', '#161618', '#EF4444', '#2563EB', '#FACC15', '#22C55E']
const VIDEO_FONTS = [
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
const VIDEO_EFFECT_OPTIONS: Array<{ id: VideoTextEffect; label: string; description: string }> = [
  { id: 'none', label: 'Limpo', description: 'Sem sombra' },
  { id: 'shadow', label: 'Sombra', description: 'Leve' },
  { id: 'outline', label: 'Contorno', description: 'Ao redor' },
  { id: 'glow', label: 'Brilho', description: 'Luz' },
  { id: 'background', label: 'Fundo', description: 'Tarja' },
  { id: 'backgroundOutline', label: 'Fundo+', description: 'Tarja + contorno' },
]
const VIDEO_ALIGN_OPTIONS: Array<{ value: CanvasTextAlign; label: string; Icon: typeof AlignLeft }> = [
  { value: 'left', label: 'Alinhar a esquerda', Icon: AlignLeft },
  { value: 'center', label: 'Centralizar', Icon: AlignCenter },
  { value: 'right', label: 'Alinhar a direita', Icon: AlignRight },
]

// Classifica um rótulo (o texto antes do primeiro ":") como FALA (o que dizer)
// ou INSTRUÇÃO (ação, visual, câmera, dica…). Retorna null se não for um rótulo
// reconhecido — aí o trecho é tratado como texto neutro.
function labelKind(label: string): 'speech' | 'instruction' | null {
  const rawL = label.toUpperCase().trim()
  if (rawL.length > 40) return null // texto comum com ":", não é um rótulo

  // Normaliza removendo acentos e convertendo Ç para C para evitar falhas no \b do JS
  const l = rawL
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/Ç/g, 'C')

  // "TEXTO NA TELA" é legenda (aparece escrito), não é fala → cai em instrução.
  // Permite plurais como FALAS, ROTEIROS e FRASES.
  if (/\b(FALA|FALAS|ROTEIRO|ROTEIROS|FRASE|FRASES|NARRACAO|NARRACOES|TEXTO FALADO|O QUE (FALAR|DIZER))\b/.test(l) && !/TELA/.test(l)) return 'speech'
  
  // Rótulos de PRODUÇÃO (visual, edição, áudio, títulos, separações de bloco…):
  // nunca são ditos em voz alta, então não vão para o teleprompter.
  // Termos normalizados sem acento e aceitando plurais e radicais flexibilizados.
  if (/\b(ACAO|ACOES|VISUAL|VISUAIS|CENA|CENAS|CAMERA|CAMERAS|ENQUADRAMENTO|ENQUADRAMENTOS|POSICAO|POSICOES|POSICIONAMENTO|TELA|TELAS|LEGENDA|LEGENDAS|TRANSICAO|TRANSICOES|EDICAO|EDICOES|CORTE|CORTES|SUGESTAO|SUGESTOES|SUGESTOES?|DICA|DICAS|OBSERVACAO|OBSERVACOES|HASHTAG|HASHTAGS|TAGS?|GANCHO|GANCHOS|CORPO|FECHAMENTO|FECHAMENTOS|STORY|STORIES|IMAGEM|IMAGENS|BASTIDOR|BASTIDORES|B-?ROLL|AUDIO|AUDIOS|SOM|SONS|TRILHA|TRILHAS|MUSICA|MUSICAS|EFEITO|EFEITOS|TITULO|TITULOS|DURACAO|DURACOES|GRAVACAO|GRAVACOES|PARTES?|BLOCOS?)\b/.test(l)) return 'instruction'
  
  return null
}

// Remove direções de cena EMBUTIDAS numa linha de fala — nunca são ditas em voz
// alta: colchetes [corte para close], chaves {b-roll} e asteriscos *olha p/ câmera*.
// Parênteses NÃO são removidos (podem ser um aparte legítimo da fala).
function stripInlineDirections(text: string): string {
  return text
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\{[^}]*\}/g, ' ')
    .replace(/\*[^*]+\*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

// Linha SEM rótulo que, ainda assim, é claramente uma direção de produção (não
// algo que a pessoa fala). Mantido propositalmente ESPECÍFICO para não descartar
// fala real (ex.: "use o fio dental" continua valendo como fala).
const DIRECTION_LINE = /^(?:corte\s+(?:para|r[áa]pido|seco|aqui)\b|corta\s+para\b|inser(?:ir|e|a)\s+(?:um\s+)?corte\b|adicion(?:ar|e)\s+(?:um\s+)?corte\b|imagem\s+de\s+bastidor\b|texto\s+na\s+tela\b|observa[çc][ãa]o\s+visual\b|edi[çc][ãa]o\s+sugerida\b|sugest[ãa]o\s+de\s+edi[çc][ãa]o\b|b-?roll\b|close\s*-?\s*up\b)/i

// Extrai do conteúdo gerado pela IA APENAS o que a pessoa deve falar.
// Descarta ação, visual, câmera, texto na tela, dica, corte, etc.
// Funciona tanto no formato estruturado (AÇÃO/ROTEIRO/DICA) quanto em roteiros
// de Reels com cena/fala misturados.
function extractSpeech(raw: string): string {
  const speechSegments: string[] = []
  const neutral: string[] = []
  let current: string[] | null = null   // bloco de fala em construção (p/ continuação)
  let hasSpeechLabel = false
  let skipping = false                  // dentro de um bloco de instrução → descartar continuações

  const flush = () => {
    if (current && current.length) speechSegments.push(current.join('\n').trim())
    current = null
  }

  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) { flush(); skipping = false; continue }  // linha em branco encerra bloco e para de pular
    const colon = line.indexOf(':')
    const kind = colon > 0 && colon <= 40 ? labelKind(line.slice(0, colon)) : null

    if (kind === 'speech') {
      flush()
      skipping = false
      hasSpeechLabel = true
      current = []
      const body = stripInlineDirections(line.slice(colon + 1).trim())
      if (body) current.push(body)
    } else if (kind === 'instruction') {
      flush()
      skipping = true                    // descartar esta linha E as continuações sem rótulo
    } else if (DIRECTION_LINE.test(line)) {
      flush()
      skipping = true                    // linha sem rótulo mas é direção → descartar
    } else if (skipping) {
      // continuação de um bloco de instrução → descarta (não vai para neutral nem para fala)
    } else if (current) {
      const clean = stripInlineDirections(line)
      if (clean) current.push(clean)     // continuação de uma fala multi-linha
    } else {
      const clean = stripInlineDirections(line)
      if (clean) neutral.push(clean)     // texto sem rótulo (fallback)
    }
  }
  flush()

  // Se a IA marcou falas explicitamente, usa só elas.
  if (hasSpeechLabel) {
    const out = speechSegments.filter(Boolean).join('\n\n').trim()
    if (out) return out
  }
  // Senão, usa o texto neutro (já sem as instruções rotuladas) ou o bruto.
  return neutral.join('\n').trim() || raw.trim()
}

// Normaliza texto p/ comparar (sem acento/pontuação/caixa) e detectar se o CTA
// já está dito dentro da fala — assim não duplicamos ao acrescentá-lo.
function normalizeForMatch(s: string): string {
  // Remove acentos (faixa Unicode de marcas combinantes U+0300–U+036F) e pontuação,
  // deixando só letras/números/espaço — para comparar fala e CTA com tolerância.
  return s
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Texto final do teleprompter: as FALAS + o CTA ao final. O CTA é algo que a
// pessoa FALA (a chamada para ação dita), então precisa aparecer no teleprompter.
// Só é acrescentado quando ainda não está presente na fala (evita repetir).
function buildTeleprompterScript(content: string, cta?: string): string {
  const speech = extractSpeech(content)
  const call = (cta ?? '').trim()
  if (!call) return speech
  if (normalizeForMatch(speech).includes(normalizeForMatch(call))) return speech
  return `${speech}\n\n${call}`.trim()
}

function formatTimer(s: number) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

function getBestMimeType(codec: RecordingCodec) {
  // H.264 first: it is the format Chrome/WebView can preview inline reliably.
  // HEVC can save with good quality, but many mobile browsers cannot play it in
  // a <video> element even when the Android gallery can.
  const compatibleCandidates = [
    'video/mp4;codecs="avc1.640028,mp4a.40.2"',      // H.264 High Profile + AAC
    'video/mp4;codecs="avc1.4D4028,mp4a.40.2"',      // H.264 Main Profile
    'video/mp4;codecs="avc1.42E01E,mp4a.40.2"',      // H.264 Baseline (fallback)
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4',
  ]
  const hevcCandidates = [
    'video/mp4;codecs="hvc1.1.6.L120.90,mp4a.40.2"', // HEVC
    'video/mp4;codecs="hev1.1.6.L120.90,mp4a.40.2"',
    'video/mp4;codecs="hvc1,mp4a.40.2"',
    ...compatibleCandidates,
  ]
  const candidates = codec === 'hevc' ? hevcCandidates : compatibleCandidates
  try { return candidates.find(t => MediaRecorder.isTypeSupported(t)) ?? '' } catch { return '' }
}

// iOS/Safari muitas vezes NÃO grava MP4/H.264 via MediaRecorder; o vídeo sai em
// WebM, que o iPhone não reproduz no <video> nem salva bem na galeria. Detectamos
// isso UMA vez (no load) para AVISAR o usuário antes de ele gravar um take inteiro
// e só descobrir no fim que o arquivo não abre.
function isMp4RecordingSupported() {
  try {
    if (typeof MediaRecorder === 'undefined') return true // sem MediaRecorder, não há o que avisar aqui
    return [
      'video/mp4;codecs="avc1.640028,mp4a.40.2"',
      'video/mp4;codecs="avc1.4D4028,mp4a.40.2"',
      'video/mp4;codecs="avc1.42E01E,mp4a.40.2"',
      'video/mp4',
    ].some(t => MediaRecorder.isTypeSupported(t))
  } catch { return true }
}
const MP4_RECORDING_SUPPORTED = isMp4RecordingSupported()

// Indica se um mimeType é HEVC (para ajustar o nome do arquivo).
function isHEVC(mime: string) {
  return /hvc1|hev1/i.test(mime)
}

function canPreviewMimeType(mime: string) {
  try {
    if (!mime || typeof document === 'undefined') return false
    return document.createElement('video').canPlayType(mime) !== ''
  } catch {
    return false
  }
}

function getPreviewMimeType() {
  const candidates = [
    'video/mp4;codecs="avc1.640028,mp4a.40.2"',
    'video/mp4;codecs="avc1.4D4028,mp4a.40.2"',
    'video/mp4;codecs="avc1.42E01E,mp4a.40.2"',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ]
  try {
    return candidates.find(t => MediaRecorder.isTypeSupported(t) && canPreviewMimeType(t)) ?? ''
  } catch {
    return ''
  }
}

// Constraints de áudio. Quando reduceNoise=false, desligamos o processamento de
// voz do navegador (eco/ruído/ganho) — esses filtros são pensados para CHAMADA,
// não para gravar conteúdo. Voz fica mais natural e encorpada (ideal em ambiente
// silencioso). Quando true, mantém o comportamento de redução de ruído.
// deviceId: quando informado (ex.: microfone USB), força o uso desse microfone —
// sem isso, o navegador costuma ignorar microfones externos e usar o embutido.
function buildAudioConstraints(reduceNoise: boolean, deviceId?: string | null): MediaTrackConstraints {
  return {
    ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
    echoCancellation: reduceNoise,
    noiseSuppression: reduceNoise,
    autoGainControl: reduceNoise,
    sampleRate: { ideal: 48000 },
    // Estéreo: áudio mais cheio e parecido com o da câmera nativa (antes era mono).
    channelCount: { ideal: 2 },
  }
}

// Identifica um microfone "conectado" (USB, fone com fio, Bluetooth) vs. o microfone
// do próprio aparelho. Quando há um conectado, ele já vira o padrão da gravação.
// Não usamos a palavra genérica "microphone" aqui porque o mic embutido do telefone
// costuma ser rotulado assim — só queremos os realmente externos.
function isExternalMic(label: string): boolean {
  return /usb|extern|headset|fone|bluetooth|airpod/i.test(label)
    && !/default|comunic|communications|built-?in|embutido|internal|interno|telefone|phone|speaker/i.test(label)
}

// Traduz e limpa o rótulo cru do sistema (que costuma vir em inglês e com códigos
// de hardware) para um nome simples e em português, mais fácil para o usuário.
function cleanMicLabel(label: string): string {
  return label
    .replace(/\([0-9a-f]{4}:[0-9a-f]{4}\)/gi, '') // remove IDs tipo (046d:0825)
    .replace(/\bdefault\b/gi, 'Padrão')
    .replace(/\bcommunications?\b/gi, 'Comunicação')
    .replace(/\bmicrophone\b/gi, 'Microfone')
    .replace(/\bbuilt-?in\b/gi, 'embutido')
    .replace(/\binternal\b/gi, 'interno')
    .replace(/\bheadset\b/gi, 'Fone com microfone')
    .replace(/\bspeakerphone\b/gi, 'Viva-voz')
    .replace(/\bwired\b/gi, 'com fio')
    .replace(/\bfront\b/gi, 'frontal')
    .replace(/\bback\b/gi, 'traseiro')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

// Nome final mostrado no seletor de microfone.
function friendlyMicLabel(rawLabel: string, index: number): string {
  const label = (rawLabel || '').trim()
  if (!label) return `Microfone ${index + 1}`
  if (isExternalMic(label)) return `Microfone conectado — ${cleanMicLabel(label)}`
  if (/default|padr[ãa]o/i.test(label)) return 'Microfone do telefone (padrão)'
  if (/communications?|comunica/i.test(label)) return 'Microfone para chamadas'
  return cleanMicLabel(label) || `Microfone ${index + 1}`
}

function getCameraAttempts(mode: 'user' | 'environment', audio: MediaTrackConstraints): MediaStreamConstraints[] {
  const facingMode = { ideal: mode }
  // IMPORTANTE: NÃO forçamos aspectRatio nem resizeMode. Forçar 3:4 + resizeMode
  // 'none' fazia o navegador entregar um RECORTE AMPLIADO do sensor (efeito de
  // zoom diferente do app nativo/Instagram). Pedindo só a altura, mantemos o
  // campo de visão natural da câmera; o recorte 9:16 é feito depois no canvas —
  // exatamente como Instagram/Reels fazem.
  return [
    { video: { facingMode, height: { ideal: 1920 }, frameRate: { ideal: 30, max: 30 } }, audio },
    { video: { facingMode, height: { ideal: 1280 }, frameRate: { ideal: 30, max: 30 } }, audio },
    { video: { facingMode, frameRate: { ideal: 30, max: 30 } }, audio },
    { video: { facingMode }, audio },
    { video: { facingMode }, audio: false },
  ]
}

async function getCameraStream(mode: 'user' | 'environment', audio: MediaTrackConstraints) {
  let lastError: unknown
  for (const constraints of getCameraAttempts(mode, audio)) {
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
  // High bitrate compensates for canvas re-encoding and keeps image quality when
  // using H.264, which is less efficient than HEVC but previews inline reliably.
  if (sourceMin >= 900 && sourceMax >= 1200) {
    return { width: 1080, height: 1920, videoBitsPerSecond: 32_000_000 }
  }
  return { width: 720, height: 1280, videoBitsPerSecond: 18_000_000 }
}

function getTrackZoomTarget(caps: { zoom?: { min: number; max: number } }, requestedZoom: number) {
  if (!caps.zoom) return null
  const normalZoom = 1 >= caps.zoom.min && 1 <= caps.zoom.max ? 1 : caps.zoom.min
  const target = requestedZoom === 1 ? normalZoom : requestedZoom
  return Math.min(caps.zoom.max, Math.max(caps.zoom.min, target))
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

function getVideoOutlineColor(fill: string) {
  return fill.toUpperCase() === '#161618' ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.78)'
}

function getVideoBackgroundColor(fill: string) {
  return fill.toUpperCase() === '#161618' ? 'rgba(255,255,255,0.72)' : 'rgba(0,0,0,0.52)'
}

function videoHasOutline(effect: VideoTextEffect) {
  return effect === 'outline' || effect === 'backgroundOutline'
}

function videoHasBackground(effect: VideoTextEffect) {
  return effect === 'background' || effect === 'backgroundOutline'
}

function getVideoTextShadow(effect: VideoTextEffect, fill: string) {
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

function getVideoPreviewEffectStyle(effect: VideoTextEffect, color: string, size: number): CSSProperties {
  return {
    background: videoHasBackground(effect) ? getVideoBackgroundColor(color) : undefined,
    borderRadius: videoHasBackground(effect) ? Math.max(8, size * 0.28) : undefined,
    padding: videoHasBackground(effect) ? `${Math.max(4, size * 0.16)}px ${Math.max(7, size * 0.28)}px` : undefined,
    WebkitTextStroke: videoHasOutline(effect) ? `${Math.max(1, size * 0.055)}px ${getVideoOutlineColor(color)}` : undefined,
    paintOrder: videoHasOutline(effect) ? 'stroke fill' : undefined,
    textShadow: getVideoTextShadow(effect, color),
  }
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

function wrapCanvasLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = []
  for (const paragraph of text.split(/\r?\n/)) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean)
    if (!words.length) { lines.push(''); continue }
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

function drawVideoCover(ctx: CanvasRenderingContext2D, video: HTMLVideoElement, width: number, height: number) {
  const vw = video.videoWidth
  const vh = video.videoHeight
  if (!vw || !vh) return
  const scale = Math.max(width / vw, height / vh)
  const dw = vw * scale
  const dh = vh * scale
  ctx.drawImage(video, (width - dw) / 2, (height - dh) / 2, dw, dh)
}

function drawVideoOverlayText(ctx: CanvasRenderingContext2D, overlay: VideoOverlayState, width: number, height: number) {
  const font = VIDEO_FONTS.find(f => f.value === overlay.font) ?? VIDEO_FONTS[0]
  ctx.save()
  ctx.translate((overlay.x / 100) * width, (overlay.y / 100) * height)
  ctx.rotate((overlay.rotation * Math.PI) / 180)
  const fontSize = Math.round((overlay.size / 360) * width)
  const fontWeight = overlay.bold ? Math.max(800, font.weight) : font.weight
  ctx.font = `${overlay.italic ? 'italic ' : ''}${fontWeight} ${fontSize}px ${overlay.font}`
  ctx.textAlign = overlay.align
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  const textBoxWidth = width * 0.82
  const lines = wrapCanvasLines(ctx, overlay.text, textBoxWidth)
  const lineHeight = fontSize * 1.08
  const startY = -((lines.length - 1) * lineHeight) / 2
  const drawX = overlay.align === 'left' ? -textBoxWidth / 2 : overlay.align === 'right' ? textBoxWidth / 2 : 0
  if (videoHasBackground(overlay.effect) && lines.length) {
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
    ctx.fillStyle = getVideoBackgroundColor(overlay.color)
    roundedRect(ctx, rectX, rectY, rectWidth, rectHeight, fontSize * 0.28)
    ctx.fill()
  }
  ctx.strokeStyle = getVideoOutlineColor(overlay.color)
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
    if (videoHasOutline(overlay.effect)) ctx.strokeText(line, drawX, y)
    ctx.fillText(line, drawX, y)
  })
  ctx.restore()
}

// Resultado do compartilhamento — discriminado para o chamador decidir o que
// mostrar (sucesso, usuário cancelou, ou sem suporte → fallback de download).
export type ShareVideoResult =
  | { success: true; method: 'web-share' }
  | { success: false; reason: 'web-share-files-not-supported' | 'aborted' | 'error'; error?: unknown }

// Compartilha um arquivo de vídeo usando a Web Share API nativa do aparelho.
// Função ISOLADA e reutilizável de propósito: quando o app virar Capacitor/app
// nativo, basta trocar a implementação aqui sem mexer no resto da UI.
//
// Importante: navigator.share existir NÃO garante que dá para enviar ARQUIVOS.
// Por isso validamos com navigator.canShare({ files }) antes de tentar. Não
// prometemos publicação automática no Instagram — só abrimos o compartilhamento
// do celular, e quem conclui a publicação é o usuário dentro do app escolhido.
export async function shareVideoFile(
  videoBlob: Blob,
  filename = 'destravai-video.webm',
  meta?: { title?: string; text?: string },
): Promise<ShareVideoResult> {
  // IMPORTANTE: o Chrome no Android (ex.: Galaxy S25) REJEITA no canShare/share
  // tipos MIME com o parâmetro de codecs (ex.: video/mp4;codecs="avc1.640028,...").
  // Por isso usamos só o tipo BASE (video/mp4 ou video/webm) no File — o conteúdo
  // do arquivo continua o mesmo; só limpamos o rótulo do tipo para o share aceitar.
  const baseType = (videoBlob.type || 'video/webm').replace(/;.*$/, '').trim() || 'video/webm'

  // A Web Share API exige um File (não aceita Blob cru).
  const videoFile = new File([videoBlob], filename, { type: baseType })

  const canShareFiles =
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [videoFile] })

  if (!canShareFiles) {
    return { success: false, reason: 'web-share-files-not-supported' }
  }

  try {
    await navigator.share({
      title: meta?.title ?? 'Vídeo criado no Destravaí',
      text: meta?.text ?? 'Vídeo pronto para postar.',
      files: [videoFile],
    })
    return { success: true, method: 'web-share' }
  } catch (err) {
    // Usuário simplesmente fechou o compartilhamento: NÃO é erro de verdade,
    // então não mostramos nada assustador — apenas voltamos ao estado anterior.
    if ((err as Error)?.name === 'AbortError') {
      return { success: false, reason: 'aborted' }
    }
    return { success: false, reason: 'error', error: err }
  }
}

const SAFE_TOP = 'max(env(safe-area-inset-top), 16px)'
const SAFE_BOTTOM = 'max(env(safe-area-inset-bottom), 18px)'
const BRAND_REC = '#FF006E'

export default function StudioModal({ idea, onClose }: Props) {
  // Dica do teleprompter (passo central) na primeira gravação.
  useScreenTour('teleprompter')
  const { addToast } = useToast()

  const [phase, setPhase] = useState<Phase>('setup')
  const [hasCamera, setHasCamera] = useState(true)
  const [facing, setFacing] = useState<'user' | 'environment'>('user')
  const [timer, setTimer] = useState(0)
  const [scrollPx, setScrollPx] = useState(0)
  const [recordedUrl, setRecordedUrl] = useState('')
  // Rede de segurança: se mesmo assim o <video> não decodificar o HEVC inline
  // neste aparelho, mostramos um aviso (o arquivo continua gravado e salvável).
  const [previewError, setPreviewError] = useState(false)

  // Teleprompter — recebe as FALAS (sem ação/visual/câmera/dica) + o CTA falado.
  const [script, setScript] = useState(() => buildTeleprompterScript(idea.content, idea.cta))
  const [showTeleprompter, setShowTeleprompter] = useState(true)
  const [showEditor, setShowEditor] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [fontSize, setFontSize] = useState(22)
  const [scrollSpeed, setScrollSpeed] = useState(1.0)   // px por tick (config do TEXTO)
  const [cardOpacity, setCardOpacity] = useState(0.9)
  // Redução de ruído do navegador. DESLIGADA por padrão: esses filtros são
  // pensados para CHAMADA e deixam a voz mais "fina"/processada. Sem eles a voz
  // sai mais natural e encorpada. O usuário liga nos ajustes só se precisar
  // (ambiente barulhento).
  const [reduceNoise, setReduceNoise] = useState(false)
  const [recordingCodec, setRecordingCodec] = useState<RecordingCodec>('compatible')
  // Microfones disponíveis e o selecionado (ex.: microfone USB externo).
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([])
  const [selectedMicId, setSelectedMicId] = useState<string | null>(null)
  const [videoTool, setVideoTool] = useState<VideoEditTool>(null)
  const [videoColorValue, setVideoColorValue] = useState('#FFFFFF')
  const [videoOverlay, setVideoOverlay] = useState<VideoOverlayState>({
    text: '',
    x: 50,
    y: 56,
    size: 16,
    rotation: 0,
    color: '#FFFFFF',
    font: VIDEO_FONTS[0].value,
    align: 'center',
    bold: true,
    italic: false,
    effect: 'shadow',
  })

  // Câmera
  const [zoom, setZoom] = useState<number>(1)            // 1x/2x/3x/5x = ZOOM
  const [showGrid, setShowGrid] = useState(false)
  const [countdownEnabled, setCountdownEnabled] = useState(true)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [showReadingLine, setShowReadingLine] = useState(true)
  const [flashOn, setFlashOn] = useState(false)

  const liveVideoRef = useRef<HTMLVideoElement>(null)
  const previewCanvasRef = useRef<HTMLCanvasElement>(null)
  const reviewVideoRef = useRef<HTMLVideoElement>(null)
  const reviewStageRef = useRef<HTMLDivElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recordingStreamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const previewRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const previewChunksRef = useRef<Blob[]>([])
  const previewBlobPromiseRef = useRef<Promise<Blob | null>>(Promise.resolve(null))
  const blobRef = useRef<Blob | null>(null)
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const scrollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // Intervalo da contagem regressiva "3-2-1". Guardado em ref para ser cancelado
  // ao fechar o modal — senão, fechado durante a contagem, ele dispararia
  // beginRecording() num componente já desmontado.
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // Marca o instante de início para medir a duração REAL (usada ao corrigir o MP4).
  const recordStartRef = useRef(0)
  const drawFrameRef = useRef<number | null>(null)
  const zoomSupportedRef = useRef(false)
  const recordingSizeRef = useRef<RecordingSize>({ width: 1080, height: 1920, videoBitsPerSecond: 14_000_000 })
  const videoPointersRef = useRef(new Map<number, PointerPoint>())
  const videoGestureStartRef = useRef<VideoGestureStart | null>(null)
  const movingVideoTextRef = useRef(false)
  const videoOverlayRef = useRef<VideoOverlayState | null>(null)
  const editedVideoBlobRef = useRef<{ key: string; blob: Blob } | null>(null)
  const pendingShareBlobRef = useRef<Blob | null>(null)
  // Sempre lê o valor atual de reduceNoise dentro de startCamera (que é memoizado).
  const reduceNoiseRef = useRef(reduceNoise)
  reduceNoiseRef.current = reduceNoise
  // Idem para o microfone selecionado.
  const selectedMicRef = useRef(selectedMicId)
  selectedMicRef.current = selectedMicId
  videoOverlayRef.current = videoOverlay
  const activeVideoFont = useMemo(() => VIDEO_FONTS.find(f => f.value === videoOverlay.font) ?? VIDEO_FONTS[0], [videoOverlay.font])
  // Refs de fase/câmera lidos dentro de listeners (visibilitychange/popstate) que
  // só são registrados uma vez — sem isso, eles enxergariam só o valor inicial.
  const phaseRef = useRef<Phase>(phase)
  phaseRef.current = phase
  const facingRef = useRef(facing)
  facingRef.current = facing
  // Marca que o fechamento já veio do botão "voltar" (popstate), para não
  // empurrar/voltar histórico em duplicidade.
  const poppedRef = useRef(false)

  useEffect(() => { ensureEditorFonts() }, [])

  useEffect(() => { editedVideoBlobRef.current = null }, [videoOverlay])

  useEffect(() => {
    if (phase !== 'preview') return
    setVideoOverlay(current => current.text.trim() ? current : { ...current, text: script.trim().split(/\n+/)[0]?.slice(0, 90) ?? '' })
  }, [phase, script])

  const stopStream = useCallback(() => {
    recordingStreamRef.current?.getTracks().forEach(t => t.stop())
    recordingStreamRef.current = null
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }, [])

  // Lista os microfones disponíveis. Só traz os rótulos após a permissão de mídia
  // ter sido concedida (por isso é chamado depois do primeiro getUserMedia).
  const refreshAudioInputs = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const mics = devices.filter(d => d.kind === 'audioinput')
      setAudioInputs(mics)
      // Se houver um microfone conectado (USB/fone/Bluetooth) e o usuário ainda não
      // escolheu nada, já o deixamos como padrão — sem precisar mexer nos ajustes.
      // Sem nenhum conectado, fica o microfone do próprio telefone.
      if (!selectedMicRef.current) {
        const external = mics.find(m => isExternalMic(m.label))
        if (external) setSelectedMicId(external.deviceId)
      }
    } catch { /* enumeração indisponível */ }
  }, [])

  const startCamera = useCallback(async (mode: 'user' | 'environment') => {
    stopStream()
    try {
      const stream = await getCameraStream(mode, buildAudioConstraints(reduceNoiseRef.current, selectedMicRef.current))
      streamRef.current = stream
      recordingSizeRef.current = getRecordingSize(stream)
      // Já temos permissão → podemos listar os microfones com rótulo.
      void refreshAudioInputs()
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
  }, [stopStream, refreshAudioInputs])

  useEffect(() => {
    startCamera('user')
    return () => {
      stopStream()
      if (drawFrameRef.current) cancelAnimationFrame(drawFrameRef.current)
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
      if (scrollIntervalRef.current) clearInterval(scrollIntervalRef.current)
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)
    }
  }, []) // eslint-disable-line

  // Botão "voltar" (navegador/Android): empurramos uma entrada no histórico ao
  // abrir o teleprompter; quando o usuário toca em voltar, o popstate consome
  // essa entrada e FECHA o modal — voltando para a área de Criar com os roteiros
  // preservados, em vez de navegar para a Home e perder o estado.
  useEffect(() => {
    window.history.pushState({ studioModal: true }, '')
    const onPopState = () => {
      poppedRef.current = true
      // Libera câmera/áudio e fecha (sem empurrar/voltar histórico de novo).
      stopRecording()
      stopStream()
      onClose()
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, []) // eslint-disable-line

  // Ciclo de vida: ao minimizar o app, trocar de aba/tela ou o app ser
  // descarregado, LIBERA câmera e microfone (senão a luz da câmera e o áudio
  // ficam ativos em segundo plano). Ao voltar para o app no modo setup, religa.
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        if (phaseRef.current === 'recording') stopRecording()
        stopStream()
      } else if (phaseRef.current === 'setup' && !streamRef.current) {
        // Voltou ao app e estava configurando → religa a câmera.
        startCamera(facingRef.current)
      }
    }
    // pagehide cobre o fechamento/descarte da página (mais confiável no iOS).
    const onPageHide = () => { stopRecording(); stopStream() }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', onPageHide)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', onPageHide)
    }
  }, []) // eslint-disable-line

  // Reaplica o áudio quando o usuário troca a redução de ruído (só fora de
  // gravação). Pula a 1ª execução para não recriar o stream logo após o mount.
  const skipNoiseEffect = useRef(true)
  useEffect(() => {
    if (skipNoiseEffect.current) { skipNoiseEffect.current = false; return }
    if (phase === 'setup') startCamera(facing)
  }, [reduceNoise]) // eslint-disable-line

  // Recria o stream ao trocar o microfone selecionado (fora de gravação).
  const skipMicEffect = useRef(true)
  useEffect(() => {
    if (skipMicEffect.current) { skipMicEffect.current = false; return }
    if (phase === 'setup') startCamera(facing)
  }, [selectedMicId]) // eslint-disable-line

  // Atualiza a lista quando um microfone é conectado/desconectado (ex.: USB).
  useEffect(() => {
    const onChange = () => { void refreshAudioInputs() }
    navigator.mediaDevices?.addEventListener?.('devicechange', onChange)
    return () => navigator.mediaDevices?.removeEventListener?.('devicechange', onChange)
  }, [refreshAudioInputs])

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
          // Redefinir width/height reseta o estado do contexto → reativar a
          // suavização em ALTA qualidade para o reescalonamento do vídeo.
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
  }, [facing, hasCamera, phase, zoom])

  // Folha de escolha pós-"Salvar": Postar agora / Postar depois / Cancelar.
  const [showSaveChoice, setShowSaveChoice] = useState(false)
  // Loading enquanto o vídeo é salvo/compartilhado (feedback p/ não ficar perdido).
  const [saving, setSaving] = useState(false)
  // Quando o compartilhamento de arquivos não é suportado, mostramos o fallback
  // de download dentro da própria folha de escolha.
  const [shareFallback, setShareFallback] = useState(false)
  // Nome do vídeo (editável antes de salvar). Default = tema da ideia.
  const [videoName, setVideoName] = useState(idea.theme)

  // Registra a abertura do teleprompter (métrica de execução).
  useEffect(() => {
    void trackEvent('teleprompter_open', idea.id)
  }, [idea.id])

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
    previewChunksRef.current = []
    previewBlobPromiseRef.current = Promise.resolve(null)
    const canvas = previewCanvasRef.current
    const mimeType = getBestMimeType(recordingCodec)
    const canvasStream = canvas.captureStream(30)
    const audioTracks = streamRef.current.getAudioTracks()
    const finalStream = new MediaStream([...canvasStream.getVideoTracks(), ...audioTracks])
    recordingStreamRef.current = finalStream
    const options: MediaRecorderOptions = {
      ...(mimeType ? { mimeType } : {}),
      videoBitsPerSecond: recordingSizeRef.current.videoBitsPerSecond,
      // 256 kbps AAC estéreo: áudio mais próximo da câmera nativa (era 192 kbps).
      ...(audioTracks.length ? { audioBitsPerSecond: 256_000 } : {}),
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
    const previewMimeType = isHEVC(mimeType) ? getPreviewMimeType() : ''
    if (previewMimeType) {
      try {
        const previewRecorder = new MediaRecorder(finalStream, {
          mimeType: previewMimeType,
          videoBitsPerSecond: recordingSizeRef.current.videoBitsPerSecond,
          ...(audioTracks.length ? { audioBitsPerSecond: 256_000 } : {}),
        })
        previewBlobPromiseRef.current = new Promise(resolve => {
          previewRecorder.ondataavailable = e => { if (e.data?.size > 0) previewChunksRef.current.push(e.data) }
          previewRecorder.onstop = () => {
            const previewType = previewRecorder.mimeType || previewMimeType
            resolve(previewChunksRef.current.length ? new Blob(previewChunksRef.current, { type: previewType }) : null)
          }
        })
        previewRecorder.start()
        previewRecorderRef.current = previewRecorder
      } catch {
        previewRecorderRef.current = null
        previewBlobPromiseRef.current = Promise.resolve(null)
      }
    } else {
      previewRecorderRef.current = null
    }
    recorder.ondataavailable = e => { if (e.data?.size > 0) chunksRef.current.push(e.data) }
    recorder.onstop = async () => {
      const type = recorder.mimeType || chunksRef.current[0]?.type || mimeType || 'video/webm'
      const rawBlob = new Blob(chunksRef.current, { type })
      // Corrige a duração do MP4 (MediaRecorder grava fMP4 com duração quebrada,
      // o que fazia o Instagram cortar o vídeo em 3-4s). Medimos a duração real
      // pelo relógio. Para WebM/erros, devolve o original sem alterar.
      const realDuration = recordStartRef.current ? (Date.now() - recordStartRef.current) / 1000 : 0
      const fixedBlob = await fixMp4Duration(rawBlob, realDuration)
      blobRef.current = fixedBlob // download/galeria: arquivo completo (HEVC), inalterado.
      const compatiblePreviewBlob = await Promise.race([
        previewBlobPromiseRef.current,
        new Promise<null>(resolve => setTimeout(() => resolve(null), 1500)),
      ])
      // Preview can use a sidecar blob when the final HEVC file is not playable
      // inline. Otherwise it uses the raw MediaRecorder blob, because the fixed
      // MP4 metadata blob can fail in mobile inline players.
      const previewType = type.replace(/;.*$/, '').trim() || type
      const previewBlob = compatiblePreviewBlob || (previewType !== type ? new Blob([rawBlob], { type: previewType }) : rawBlob)
      if (recordedUrl) URL.revokeObjectURL(recordedUrl)
      setPreviewError(false)
      setRecordedUrl(URL.createObjectURL(previewBlob))
      stopStream()
      setPhase('preview')
    }
    // Sem timeslice: o MediaRecorder finaliza um arquivo único e mais íntegro
    // (o timeslice fragmentava ainda mais e piorava os metadados de duração).
    recorder.start()
    recorderRef.current = recorder
    recordStartRef.current = Date.now()
    void trackEvent('recording_start', idea.id)
    setPhase('recording')
    setTimer(0)
    setScrollPx(0)
    timerIntervalRef.current = setInterval(() => setTimer(t => t + 1), 1000)
    scrollIntervalRef.current = setInterval(() => setScrollPx(px => px + scrollSpeed), 50)
  }

  const stopRecording = () => {
    if (timerIntervalRef.current) { clearInterval(timerIntervalRef.current); timerIntervalRef.current = null }
    if (scrollIntervalRef.current) { clearInterval(scrollIntervalRef.current); scrollIntervalRef.current = null }
    if (countdownIntervalRef.current) { clearInterval(countdownIntervalRef.current); countdownIntervalRef.current = null }
    if (previewRecorderRef.current?.state === 'recording') previewRecorderRef.current.stop()
    recorderRef.current?.stop()
  }

  // Botão principal: grava / para (com countdown opcional)
  const handleRecordPress = () => {
    if (phase === 'recording') { stopRecording(); return }
    if (!hasCamera) return
    if (countdownEnabled) {
      // Guarda o id na ref e zera a contagem anterior (anti-duplo-toque) — assim o
      // cleanup do modal consegue cancelar se o usuário fechar no meio do "3-2-1".
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)
      let n = 3
      setCountdown(n)
      countdownIntervalRef.current = setInterval(() => {
        n -= 1
        if (n <= 0) {
          if (countdownIntervalRef.current) { clearInterval(countdownIntervalRef.current); countdownIntervalRef.current = null }
          setCountdown(null); beginRecording()
        } else setCountdown(n)
      }, 1000)
    } else {
      beginRecording()
    }
  }

  // Libera TODOS os recursos de mídia (câmera + microfone) e fecha o modal.
  // Centraliza o cleanup para garantir que nada fique ativo ao sair.
  const releaseAndClose = () => {
    stopRecording()
    stopStream()
    onClose()
  }

  // Fechar via UI (X, "fechar sem salvar"). LIBERA câmera/áudio e fecha
  // IMEDIATAMENTE — não dá para depender do history.back() disparar o popstate:
  // se outro fluxo empurrou uma entrada no histórico, ou no iOS PWA (instável), o
  // back() pode ir para o lugar errado e a câmera ficaria PRESA acesa. O back()
  // entra só como limpeza da entrada que empurramos ao abrir; como o modal já
  // desmonta (onClose remove o listener de popstate), o popstate resultante é
  // inofensivo.
  const handleClose = () => {
    if (poppedRef.current) { releaseAndClose(); return }
    poppedRef.current = true
    releaseAndClose()
    window.history.back()
  }

  const retake = () => {
    setRecordedUrl(''); setScrollPx(0); setTimer(0); setPhase('setup'); startCamera(facing)
  }

  const canShare = typeof navigator !== 'undefined' && !!navigator.share

  // Nome de arquivo seguro derivado do nome do vídeo (ou tema da ideia).
  const getVideoFilename = (blob: Blob) => {
    const ext = blob.type.includes('mp4') ? 'mp4' : 'webm'
    const safeName = (videoName || idea.theme)
      .trim()
      .replace(/[\\/:*?"<>|]+/g, '')   // remove caracteres inválidos em nome de arquivo
      .replace(/\s+/g, '-')
      .toLowerCase()
    return `${safeName || 'destravai-video'}.${ext}`
  }

  // Telemetria do salvamento (formato + codec + duração). Reaproveitada pelos
  // fluxos "postar agora" e "postar depois" — ambos salvam de fato o vídeo.
  const trackRecordingSave = (blob: Blob) => {
    void trackEvent('recording_save', idea.id, {
      mimeType: blob.type, codec: isHEVC(blob.type) ? 'hevc' : (blob.type.includes('mp4') ? 'h264' : 'webm'),
      durationSec: timer, name: videoName,
    })
  }

  // Download direto no dispositivo (fluxo "postar depois" e fallback do share).
  const triggerPlainDownload = (blob: Blob, filename: string) => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob); a.download = filename
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
  }

  // Clique em "Salvar" no preview: NÃO salva direto — abre a folha de escolha.
  const handleSaveClick = () => {
    if (!blobRef.current) return
    pendingShareBlobRef.current = null
    setShareFallback(false)
    setShowSaveChoice(true)
  }

  // POSTAR AGORA: salva o vídeo e abre o compartilhamento nativo do aparelho,
  // para o usuário escolher Instagram, WhatsApp, galeria, etc. (não publicamos
  // automaticamente — só entregamos o vídeo pronto e abrimos o caminho).
  const handlePostNow = async () => {
    if (saving) return
    setSaving(true)
    const blob = await getPreparedVideoBlob().catch(() => blobRef.current)
    if (!blob) { setSaving(false); return }
    pendingShareBlobRef.current = blob
    const filename = getVideoFilename(blob)
    trackRecordingSave(blob)
    void trackEvent('post_now_clicked', idea.id)
    const result = await shareVideoFile(blob, filename, { title: idea.theme })
    setSaving(false)

    if (result.success) {
      // Vídeo salvo + compartilhamento aberto. Registra a tentativa E conta como
      // CONTEÚDO POSTADO ('posted') — é isso que alimenta missões/conquistas e a
      // constância (achievementsService conta event_type === 'posted').
      void trackEvent('shared_attempted', idea.id, { method: result.method })
      void trackEvent('posted', idea.id)
      setShowSaveChoice(false)
      handleClose()
      addToast('Vídeo pronto e registrado como postado! 🎉', 'success')
      return
    }
    // Usuário só fechou o share → não assustar; permanece na folha de escolha.
    if (result.reason === 'aborted') return
    // Sem suporte a compartilhar arquivos (ou erro) → oferece o download.
    setShareFallback(true)
  }

  // POSTAR DEPOIS: salva no dispositivo SEM abrir o compartilhamento e marca o
  // vídeo como ainda não publicado (pendente), para o usuário postar quando quiser.
  const handlePostLater = async () => {
    const blob = pendingShareBlobRef.current ?? blobRef.current
    if (!blob || saving) return
    setSaving(true)
    const prepared = await getPreparedVideoBlob().catch(() => null)
    const finalBlob = prepared ?? blob
    setSaving(false)
    const filename = getVideoFilename(finalBlob)
    trackRecordingSave(finalBlob)
    triggerPlainDownload(finalBlob, filename)
    void trackEvent('will_post_later', idea.id)
    setShowSaveChoice(false)
    addToast('Vídeo salvo. Você pode postar quando quiser.', 'success')
    handleClose()
  }

  // Fallback quando o compartilhamento de arquivos não é suportado: baixa o vídeo
  // para o usuário postar manualmente nos Stories. Como o clique foi em "Postar
  // agora", também conta como conteúdo postado nas missões.
  const handleFallbackDownload = () => {
    const blob = pendingShareBlobRef.current ?? blobRef.current
    if (!blob) return
    trackRecordingSave(blob)
    triggerPlainDownload(blob, getVideoFilename(blob))
    void trackEvent('posted', idea.id)
    setShowSaveChoice(false)
    setShareFallback(false)
    handleClose()
    addToast('Vídeo baixado e registrado como postado! 🎉', 'success')
  }

  // Cancelar: fecha a folha e volta ao preview, sem perder o vídeo gravado.
  const handleCancelSave = () => {
    if (saving) return
    setShareFallback(false)
    setShowSaveChoice(false)
  }

  const videoPointerToPercent = (clientX: number, clientY: number) => {
    const rect = reviewStageRef.current?.getBoundingClientRect()
    if (!rect) return null
    return {
      x: clamp(((clientX - rect.left) / rect.width) * 100, 8, 92),
      y: clamp(((clientY - rect.top) / rect.height) * 100, 8, 92),
    }
  }

  const moveVideoTextTo = (clientX: number, clientY: number) => {
    const next = videoPointerToPercent(clientX, clientY)
    if (next) setVideoOverlay(current => ({ ...current, ...next }))
  }

  const startVideoGesture = () => {
    const points = Array.from(videoPointersRef.current.values())
    const current = videoOverlayRef.current
    if (points.length < 2 || !current) return
    const [a, b] = points
    const mid = pointerMidpoint(a, b)
    const pos = videoPointerToPercent(mid.x, mid.y)
    videoGestureStartRef.current = {
      distance: Math.max(1, pointerDistance(a, b)),
      angle: pointerAngle(a, b),
      size: current.size,
      rotation: current.rotation,
      x: pos?.x ?? current.x,
      y: pos?.y ?? current.y,
    }
  }

  const handleVideoStagePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('[data-video-editor-control="true"]')) return
    event.currentTarget.setPointerCapture(event.pointerId)
    videoPointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    const isTextPointer = !!(event.target as HTMLElement).closest('[data-video-text-overlay="true"]')
    if (videoPointersRef.current.size >= 2) {
      event.preventDefault()
      movingVideoTextRef.current = true
      startVideoGesture()
      return
    }
    movingVideoTextRef.current = isTextPointer
    videoGestureStartRef.current = null
    if (isTextPointer) {
      event.preventDefault()
      moveVideoTextTo(event.clientX, event.clientY)
    }
  }

  const handleVideoStagePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!videoPointersRef.current.has(event.pointerId)) return
    videoPointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    const points = Array.from(videoPointersRef.current.values())
    if (points.length >= 2) {
      event.preventDefault()
      movingVideoTextRef.current = true
      const [a, b] = points
      const start = videoGestureStartRef.current
      if (!start) { startVideoGesture(); return }
      const dist = pointerDistance(a, b)
      const angle = pointerAngle(a, b)
      const mid = pointerMidpoint(a, b)
      const pos = videoPointerToPercent(mid.x, mid.y)
      setVideoOverlay(current => ({
        ...current,
        size: clamp(Math.round(start.size * (dist / start.distance)), VIDEO_TEXT_SIZE_MIN, VIDEO_TEXT_SIZE_MAX),
        rotation: start.rotation + (angle - start.angle),
        x: pos?.x ?? start.x,
        y: pos?.y ?? start.y,
      }))
      return
    }
    if (movingVideoTextRef.current) {
      event.preventDefault()
      moveVideoTextTo(event.clientX, event.clientY)
    }
  }

  const handleVideoStagePointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    videoPointersRef.current.delete(event.pointerId)
    if (videoPointersRef.current.size >= 2) {
      startVideoGesture()
      return
    }
    videoGestureStartRef.current = null
    if (videoPointersRef.current.size === 0) movingVideoTextRef.current = false
  }

  const videoOverlayKey = () => JSON.stringify(videoOverlay)

  const renderEditedVideoBlob = async (sourceBlob: Blob, overlay: VideoOverlayState): Promise<Blob> => {
    if (!overlay.text.trim()) return sourceBlob
    ensureEditorFonts()
    const src = URL.createObjectURL(sourceBlob)
    const video = document.createElement('video')
    video.src = src
    video.muted = false
    video.playsInline = true
    video.preload = 'auto'
    video.crossOrigin = 'anonymous'

    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve()
      video.onerror = () => reject(new Error('Nao foi possivel preparar o video editado.'))
    })

    const width = 1080
    const height = 1920
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) throw new Error('Canvas indisponivel.')
    const font = VIDEO_FONTS.find(f => f.value === overlay.font) ?? VIDEO_FONTS[0]
    const fontSize = Math.round((overlay.size / 360) * width)
    const fontWeight = overlay.bold ? Math.max(800, font.weight) : font.weight
    try { await document.fonts?.load(`${overlay.italic ? 'italic ' : ''}${fontWeight} ${fontSize}px ${overlay.font}`) } catch { /* fallback */ }

    const canvasStream = canvas.captureStream(30)
    const sourceStream = (video as HTMLVideoElement & { captureStream?: () => MediaStream; mozCaptureStream?: () => MediaStream }).captureStream?.()
      ?? (video as HTMLVideoElement & { mozCaptureStream?: () => MediaStream }).mozCaptureStream?.()
    const audioTracks = sourceStream?.getAudioTracks() ?? []
    const outputStream = new MediaStream([...canvasStream.getVideoTracks(), ...audioTracks])
    const mimeType = getBestMimeType('compatible')
    const recorder = new MediaRecorder(outputStream, {
      ...(mimeType ? { mimeType } : {}),
      videoBitsPerSecond: recordingSizeRef.current.videoBitsPerSecond,
      ...(audioTracks.length ? { audioBitsPerSecond: 256_000 } : {}),
    })
    const chunks: Blob[] = []
    recorder.ondataavailable = event => { if (event.data?.size > 0) chunks.push(event.data) }
    const stopped = new Promise<Blob>(resolve => {
      recorder.onstop = async () => {
        const type = recorder.mimeType || mimeType || 'video/webm'
        const raw = new Blob(chunks, { type })
        const fixed = await fixMp4Duration(raw, video.duration || timer || 0)
        resolve(fixed)
      }
    })

    const draw = () => {
      if (video.paused || video.ended) return
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, width, height)
      drawVideoCover(ctx, video, width, height)
      drawVideoOverlayText(ctx, overlay, width, height)
      requestAnimationFrame(draw)
    }

    recorder.start()
    await video.play()
    draw()
    await new Promise<void>(resolve => { video.onended = () => resolve() })
    if (recorder.state === 'recording') recorder.stop()
    const result = await stopped
    outputStream.getTracks().forEach(track => track.stop())
    URL.revokeObjectURL(src)
    return result
  }

  const getPreparedVideoBlob = async () => {
    const source = blobRef.current
    if (!source) return null
    const key = videoOverlayKey()
    if (!videoOverlay.text.trim()) return source
    if (editedVideoBlobRef.current?.key === key) return editedVideoBlobRef.current.blob
    const rendered = await renderEditedVideoBlob(source, videoOverlay)
    editedVideoBlobRef.current = { key, blob: rendered }
    return rendered
  }

  const toggleVideoTool = (tool: VideoEditTool) => setVideoTool(current => current === tool ? null : tool)

  const renderVideoEditorPanel = () => {
    if (!videoTool) return null
    const activeButtonStyle = { background: '#fff', color: '#111', border: '1px solid rgba(255,255,255,0.2)' }
    const inactiveButtonStyle = { background: 'rgba(255,255,255,0.12)', color: '#fff', border: '1px solid rgba(255,255,255,0.14)' }
    return (
      <div
        className="absolute z-30 left-3 right-3 bottom-3 rounded-3xl p-3"
        data-video-editor-control="true"
        style={{ background: 'rgba(0,0,0,0.62)', backdropFilter: 'blur(14px)', border: '1px solid rgba(255,255,255,0.14)' }}
      >
        {videoTool === 'text' && (
          <>
            <button
              type="button"
              onClick={() => setVideoTool(null)}
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
              value={videoOverlay.text}
              onChange={event => setVideoOverlay(current => ({ ...current, text: event.target.value }))}
              autoFocus
            />
          </>
        )}
        {videoTool === 'font' && (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide" style={{ touchAction: 'pan-x' }}>
            {VIDEO_FONTS.map(font => {
              const active = videoOverlay.font === font.value
              return (
                <button
                  key={font.label}
                  type="button"
                  onClick={() => setVideoOverlay(current => ({ ...current, font: font.value }))}
                  className="h-16 min-w-[92px] rounded-2xl px-3 flex flex-col items-center justify-center active:scale-95"
                  style={active ? activeButtonStyle : inactiveButtonStyle}
                >
                  <span className="text-lg leading-none truncate max-w-full" style={{ fontFamily: font.value, fontWeight: font.weight }}>
                    {font.label}
                  </span>
                  <span className="text-[10px] mt-1 opacity-70 font-sans">Fonte</span>
                </button>
              )
            })}
          </div>
        )}
        {videoTool === 'style' && (
          <div className="grid grid-cols-5 gap-2">
            <button type="button" onClick={() => setVideoOverlay(current => ({ ...current, bold: !current.bold }))}
              className="h-11 rounded-2xl flex items-center justify-center" style={videoOverlay.bold ? activeButtonStyle : inactiveButtonStyle} aria-label="Negrito">
              <Bold size={18} />
            </button>
            <button type="button" onClick={() => setVideoOverlay(current => ({ ...current, italic: !current.italic }))}
              className="h-11 rounded-2xl flex items-center justify-center" style={videoOverlay.italic ? activeButtonStyle : inactiveButtonStyle} aria-label="Italico">
              <Italic size={18} />
            </button>
            {VIDEO_ALIGN_OPTIONS.map(({ value, label, Icon }) => (
              <button key={value} type="button" onClick={() => setVideoOverlay(current => ({ ...current, align: value }))}
                className="h-11 rounded-2xl flex items-center justify-center" style={videoOverlay.align === value ? activeButtonStyle : inactiveButtonStyle} aria-label={label}>
                <Icon size={18} />
              </button>
            ))}
          </div>
        )}
        {videoTool === 'color' && (
          <div className="grid grid-cols-[repeat(6,minmax(0,1fr))_52px] gap-2">
            {VIDEO_PRIMARY_COLORS.map(color => (
              <button key={color} type="button" onClick={() => { setVideoColorValue(color); setVideoOverlay(current => ({ ...current, color })) }}
                className="aspect-square rounded-full active:scale-90"
                style={{
                  background: color,
                  border: videoOverlay.color === color ? '2px solid #fff' : '1px solid rgba(255,255,255,0.32)',
                  boxShadow: color === '#FFFFFF' ? 'inset 0 0 0 1px rgba(0,0,0,0.2)' : 'none',
                }}
                aria-label={`Usar cor ${color}`}
              />
            ))}
            <input
              type="color"
              value={videoColorValue}
              onChange={event => {
                const next = event.target.value.toUpperCase()
                setVideoColorValue(next)
                setVideoOverlay(current => ({ ...current, color: next }))
              }}
              className="w-[52px] h-[52px] rounded-full overflow-hidden"
              aria-label="Escolher cor"
            />
          </div>
        )}
        {videoTool === 'effect' && (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide" style={{ touchAction: 'pan-x' }}>
            {VIDEO_EFFECT_OPTIONS.map(effect => {
              const active = videoOverlay.effect === effect.id
              const previewColor = videoHasBackground(effect.id) || videoHasOutline(effect.id) ? '#FFFFFF' : active ? '#111111' : '#FFFFFF'
              return (
                <button key={effect.id} type="button" onClick={() => setVideoOverlay(current => ({ ...current, effect: effect.id }))}
                  className="h-16 min-w-[98px] rounded-2xl px-3 flex flex-col items-center justify-center active:scale-95 overflow-hidden"
                  style={active ? activeButtonStyle : inactiveButtonStyle}
                >
                  <span className="text-base leading-none font-black" style={{ color: previewColor, ...getVideoPreviewEffectStyle(effect.id, previewColor, 16) }}>
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

  // ── PREVIEW ───────────────────────────────────────────────
  if (phase === 'preview') {
    return createPortal((
      <div className="fixed inset-0 z-[100] bg-black flex flex-col" style={{ height: '100dvh' }}>
        <div className="flex-1 min-h-0 flex items-center justify-center bg-black">
          {previewError ? (
            <div className="text-center px-10">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ background: 'rgba(83,214,161,0.15)', border: '1px solid rgba(83,214,161,0.3)' }}>
                <Check size={26} style={{ color: '#53D6A1' }} />
              </div>
              <p className="text-white font-bold text-base mb-1">Vídeo gravado!</p>
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
                A pré-visualização não rodou neste aparelho, mas o arquivo está pronto. Toque em <strong style={{ color: '#fff' }}>Salvar na galeria</strong>.
              </p>
            </div>
          ) : (
            <div
              ref={reviewStageRef}
              className="relative w-full h-full max-w-[480px] mx-auto overflow-hidden bg-black touch-none select-none"
              onPointerDown={handleVideoStagePointerDown}
              onPointerMove={handleVideoStagePointerMove}
              onPointerUp={handleVideoStagePointerEnd}
              onPointerCancel={handleVideoStagePointerEnd}
            >
              <video
                ref={reviewVideoRef}
                src={recordedUrl}
                controls
                playsInline
                onError={() => setPreviewError(true)}
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div
                className="absolute z-20 left-3 top-1/2 -translate-y-1/2 flex flex-col overflow-hidden rounded-full"
                data-video-editor-control="true"
                style={{ background: 'rgba(0,0,0,0.42)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.14)' }}
              >
                <button type="button" onClick={() => setVideoOverlay(current => ({ ...current, size: clamp(current.size + VIDEO_TEXT_SIZE_STEP, VIDEO_TEXT_SIZE_MIN, VIDEO_TEXT_SIZE_MAX) }))}
                  className="w-11 h-11 flex items-center justify-center text-white active:scale-95" aria-label="Aumentar texto">
                  <Plus size={18} />
                </button>
                <div className="h-px" style={{ background: 'rgba(255,255,255,0.16)' }} />
                <button type="button" onClick={() => setVideoOverlay(current => ({ ...current, size: clamp(current.size - VIDEO_TEXT_SIZE_STEP, VIDEO_TEXT_SIZE_MIN, VIDEO_TEXT_SIZE_MAX) }))}
                  className="w-11 h-11 flex items-center justify-center text-white active:scale-95" aria-label="Diminuir texto">
                  <Minus size={18} />
                </button>
              </div>
              {videoOverlay.text.trim() && (
                <div
                  data-video-text-overlay="true"
                  className="absolute w-[82%] leading-none cursor-grab active:cursor-grabbing touch-none z-20"
                  style={{
                    left: `${videoOverlay.x}%`,
                    top: `${videoOverlay.y}%`,
                    transform: `translate(-50%, -50%) rotate(${videoOverlay.rotation}deg)`,
                    color: videoOverlay.color,
                    fontFamily: videoOverlay.font,
                    fontWeight: videoOverlay.bold ? Math.max(800, activeVideoFont.weight) : activeVideoFont.weight,
                    fontStyle: videoOverlay.italic ? 'italic' : 'normal',
                    fontSize: videoOverlay.size,
                    textAlign: videoOverlay.align as 'left' | 'center' | 'right',
                    lineHeight: 1.06,
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  <span className="inline-block max-w-full" style={{ color: videoOverlay.color, ...getVideoPreviewEffectStyle(videoOverlay.effect, videoOverlay.color, videoOverlay.size) }}>
                    {videoOverlay.text}
                  </span>
                </div>
              )}
              <div
                className="absolute z-30 right-3 flex flex-col gap-4 items-center"
                data-video-editor-control="true"
                style={{ top: 'calc(max(env(safe-area-inset-top), 14px) + 20px)' }}
              >
                <VideoIconTool active={videoTool === 'text'} onClick={() => toggleVideoTool('text')} label="Editar texto"><Type size={23} /></VideoIconTool>
                <VideoIconTool active={videoTool === 'font'} onClick={() => toggleVideoTool('font')} label="Fonte"><span className="text-lg font-black">Aa</span></VideoIconTool>
                <VideoIconTool active={videoTool === 'style'} onClick={() => toggleVideoTool('style')} label="Estilo"><Bold size={22} /></VideoIconTool>
                <VideoIconTool active={videoTool === 'color'} onClick={() => toggleVideoTool('color')} label="Cor"><Palette size={22} /></VideoIconTool>
                <VideoIconTool active={videoTool === 'effect'} onClick={() => toggleVideoTool('effect')} label="Efeitos"><Circle size={22} /></VideoIconTool>
              </div>
              {renderVideoEditorPanel()}
            </div>
          )}
        </div>
        <div className="flex-shrink-0 px-5 pt-4 space-y-3" style={{ background: '#111', paddingBottom: SAFE_BOTTOM }}>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Nome do vídeo
            </label>
            <input
              value={videoName}
              onChange={e => setVideoName(e.target.value)}
              placeholder="Nome do vídeo"
              className="w-full mt-1 rounded-xl px-3 py-2.5 text-sm outline-none"
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff' }}
            />
          </div>
          <div className="flex gap-3">
            <button onClick={retake} className="flex-1 py-3.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.98]"
              style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.12)' }}>
              <RotateCcw size={15} /> Regravar
            </button>
            <button onClick={handleSaveClick} className="flex-1 py-3.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.98]"
              style={{ background: 'linear-gradient(135deg, #6D5DF6, #9B8CFF)', color: '#fff', boxShadow: '0 4px 20px rgba(109,93,246,0.4)' }}>
              {canShare ? <><Share2 size={15} /> Salvar</> : <><Download size={15} /> Salvar</>}
            </button>
          </div>
          <button onClick={handleClose} className="w-full py-2 text-xs text-center" style={{ color: 'rgba(255,255,255,0.35)' }}>
            Fechar sem salvar
          </button>
        </div>

        {/* Folha de escolha pós-"Salvar": Postar agora / Postar depois / Cancelar */}
        {showSaveChoice && (
          <div className="absolute inset-0 z-20 flex flex-col justify-end" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
            onClick={e => { if (e.target === e.currentTarget) handleCancelSave() }}>
            <div className="rounded-t-3xl p-5 space-y-3" style={{ background: '#16151c', borderTop: '1px solid rgba(255,255,255,0.1)', paddingBottom: SAFE_BOTTOM }}>
              {shareFallback ? (
                // Fallback amigável: o aparelho não permite compartilhar o arquivo.
                <>
                  <p className="font-extrabold text-base text-white">Compartilhamento indisponível</p>
                  <p className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
                    Seu celular ou navegador não permite compartilhar esse vídeo diretamente. Baixe o vídeo e poste manualmente nos Stories.
                  </p>
                  <button onClick={handleFallbackDownload} className="w-full py-3.5 rounded-2xl text-sm font-bold text-white flex items-center justify-center gap-2 active:scale-[0.98]"
                    style={{ background: 'linear-gradient(135deg, #6D5DF6, #9B8CFF)' }}>
                    <Download size={16} /> Baixar vídeo
                  </button>
                  <button onClick={handleCancelSave} className="w-full py-2 text-xs text-center" style={{ color: 'rgba(255,255,255,0.45)' }}>
                    Voltar
                  </button>
                </>
              ) : (
                <>
                  <p className="font-extrabold text-base text-white">O que você quer fazer com esse vídeo?</p>
                  <p className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
                    Você pode postar agora ou salvar para usar depois.
                  </p>

                  {/* Postar agora — abre as opções de compartilhamento do celular */}
                  <button onClick={handlePostNow} disabled={saving}
                    className="w-full py-3 rounded-2xl text-white flex flex-col items-center justify-center active:scale-[0.98] disabled:opacity-80"
                    style={{ background: 'linear-gradient(135deg, #53D6A1, #3BB88A)' }}>
                    {saving ? (
                      <span className="flex items-center gap-2 font-bold text-sm py-0.5">
                        <Loader2 size={16} className="animate-spin" /> Salvando vídeo…
                      </span>
                    ) : (
                      <>
                        <span className="font-bold text-sm">Postar agora</span>
                        <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.85)' }}>Abrir opções de compartilhamento</span>
                      </>
                    )}
                  </button>

                  {/* Postar depois — salva no dispositivo, sem abrir compartilhamento */}
                  <button onClick={handlePostLater} disabled={saving}
                    className="w-full py-3 rounded-2xl flex flex-col items-center justify-center active:scale-[0.98] disabled:opacity-60"
                    style={{ background: 'rgba(255,255,255,0.08)', color: '#fff', border: '1px solid rgba(255,255,255,0.12)' }}>
                    <span className="font-bold text-sm">Postar depois</span>
                    <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.5)' }}>Salvar para postar depois</span>
                  </button>

                  <button onClick={handleCancelSave} disabled={saving} className="w-full py-2 text-xs text-center disabled:opacity-60" style={{ color: 'rgba(255,255,255,0.45)' }}>
                    Cancelar
                  </button>
                </>
              )}
            </div>
          </div>
        )}
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
          {/* Linha guia de leitura translúcida */}
          {showReadingLine && (
            <div
              className="absolute left-0 right-0 pointer-events-none"
              style={{
                top: '30%',
                height: `${fontSize + 10}px`,
                background: 'linear-gradient(90deg, rgba(109,93,246,0.15), rgba(155,140,255,0.15))',
                borderTop: '1px solid rgba(155,140,255,0.35)',
                borderBottom: '1px solid rgba(155,140,255,0.35)',
                transform: 'translateY(-50%)',
              }}
            />
          )}
          {/* Texto / placeholder */}
          <div className="flex-1 overflow-hidden px-5" 
            style={{ paddingTop: `calc(32vh * 0.3 - ${(fontSize * 1.5) / 2}px)` }}
            onClick={() => !recording && setShowEditor(true)}>
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
          {/* X do card (esconder) — posicionado à ESQUERDA para não sobrepor o X
              principal "Fechar estúdio" que fica no canto superior DIREITO (right-14). */}
          <button onClick={() => setShowTeleprompter(false)} className="absolute top-3 left-3 w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.3)' }} aria-label="Esconder teleprompter">
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
        {/* Aviso de compatibilidade (T4): só no setup, quando o aparelho não grava
            MP4/H.264 — alerta ANTES de gravar um take que o iPhone não reproduziria. */}
        {!MP4_RECORDING_SUPPORTED && !recording && (
          <div className="mx-4 px-3.5 py-2 rounded-2xl text-center text-[11px] leading-snug font-semibold"
            style={{ background: 'rgba(247,185,85,0.16)', border: '1px solid rgba(247,185,85,0.4)', color: '#F7D58A', maxWidth: 340 }}>
            Seu navegador pode salvar o vídeo num formato que o iPhone não reproduz.
            Se possível, grave pelo Chrome ou em outro aparelho — ou leia o roteiro aqui e grave pela câmera do celular.
          </div>
        )}
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

            <div className="pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-semibold text-white/80">Qualidade do vídeo</span>
                <span className="text-sm font-bold" style={{ color: '#9B8CFF' }}>
                  {recordingCodec === 'hevc' ? 'HEVC' : 'H.264'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 rounded-2xl p-1" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                {([
                  ['compatible', 'Compatível'],
                  ['hevc', 'Máxima HEVC'],
                ] as const).map(([value, label]) => {
                  const active = recordingCodec === value
                  return (
                    <button
                      key={value}
                      onClick={() => setRecordingCodec(value)}
                      className="h-10 rounded-xl text-xs font-extrabold transition-colors"
                      style={active
                        ? { background: '#7C5CFF', color: '#fff' }
                        : { background: 'transparent', color: 'rgba(255,255,255,0.62)' }}>
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Linha guia de leitura translúcida */}
            <div className="flex items-center justify-between gap-3 pt-1" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="flex-1 pt-3">
                <span className="text-sm font-semibold text-white/80">Linha guia de leitura</span>
                <p className="text-[11px] mt-0.5 text-white/40">
                  Exibe uma linha horizontal translúcida para ajudar a focar o olhar durante a gravação.
                </p>
              </div>
              <button
                onClick={() => setShowReadingLine(v => !v)}
                role="switch"
                aria-checked={showReadingLine}
                aria-label="Linha guia de leitura"
                className="relative flex-shrink-0 rounded-full transition-colors"
                style={{ width: 48, height: 28, background: showReadingLine ? '#7C5CFF' : 'rgba(255,255,255,0.15)' }}>
                <span className="absolute rounded-full bg-white transition-all" style={{ top: 4, width: 20, height: 20, left: showReadingLine ? 24 : 4 }} />
              </button>
            </div>

            {/* Áudio: redução de ruído (filtros de chamada) — desligar = voz mais natural */}
            <div className="flex items-center justify-between gap-3 pt-1" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="flex-1 pt-3">
                <span className="text-sm font-semibold text-white/80">Reduzir ruído de fundo</span>
                <p className="text-[11px] mt-0.5 text-white/40">
                  Desligue para uma voz mais natural e encorpada (recomendado em ambiente silencioso).
                </p>
              </div>
              <button
                onClick={() => setReduceNoise(v => !v)}
                role="switch"
                aria-checked={reduceNoise}
                aria-label="Reduzir ruído de fundo"
                className="relative flex-shrink-0 rounded-full transition-colors"
                style={{ width: 48, height: 28, background: reduceNoise ? '#7C5CFF' : 'rgba(255,255,255,0.15)' }}>
                <span className="absolute rounded-full bg-white transition-all" style={{ top: 4, width: 20, height: 20, left: reduceNoise ? 24 : 4 }} />
              </button>
            </div>

            {/* Seletor de microfone — usa o conectado se houver, senão o do telefone */}
            {audioInputs.length > 1 && (
              <div className="pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                <span className="text-sm font-semibold text-white/80">Microfone</span>
                <p className="text-[11px] mt-0.5 mb-2 text-white/40">
                  Conectou um microfone (USB, fone ou Bluetooth)? Ele já é usado sozinho.
                  Sem nenhum conectado, gravamos com o microfone do telefone. Troque aqui quando quiser.
                </p>
                <select
                  value={selectedMicId ?? ''}
                  onChange={e => setSelectedMicId(e.target.value || null)}
                  className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                  style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff' }}>
                  <option value="">Microfone do telefone (padrão)</option>
                  {audioInputs.map((mic, i) => (
                    <option key={mic.deviceId} value={mic.deviceId} style={{ color: '#111' }}>
                      {friendlyMicLabel(mic.label, i)}
                    </option>
                  ))}
                </select>
              </div>
            )}

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

function VideoIconTool({ active, onClick, label, children }: { active: boolean; onClick: () => void; label: string; children: ReactNode }) {
  const activeButtonStyle = { background: '#fff', color: '#111', border: '1px solid rgba(255,255,255,0.2)' }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="w-11 h-11 rounded-full flex items-center justify-center active:scale-95"
      style={active ? activeButtonStyle : { background: 'rgba(0,0,0,0.44)', color: '#fff', border: '1px solid rgba(255,255,255,0.14)', backdropFilter: 'blur(10px)' }}
    >
      {children}
    </button>
  )
}
