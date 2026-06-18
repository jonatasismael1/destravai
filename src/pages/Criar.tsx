import { useState, useEffect, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { Sparkles, RefreshCw, Copy, Check, ChevronDown, Zap, Camera, Mic, FileText, X, Smartphone, Film, LayoutList, PenLine, Coffee, Star, ChevronRight, ChevronLeft, Image } from 'lucide-react'
import type { ContentIdea, ContentModel, ContentObjective, ContentMedia } from '../types'
import type { LibraryItemType } from '../lib/supabase/types'
import { generateContent, generateCaption, generatePersonalizedCTAs, generateFreeStory, ideaFromOwnScript } from '../lib/ai'
import ScriptCard from '../components/ScriptCard'
import { createLibraryItem, updateLibraryItem } from '../services/libraryService'
import StudioModal from '../components/StudioModal'
import PhotoTextComposer from '../components/PhotoTextComposer'
import VoiceDictation from '../components/VoiceDictation'
import { useScreenTour } from '../context/OnboardingContext'

// Toda ideia gerada é salva na biblioteca do Supabase (não só no estado local).
function ideaToLibraryType(type: ContentIdea['type']): LibraryItemType {
  if (type === 'reel') return 'reels_script'
  if (type === 'sequence') return 'story_sequence'
  return 'content_idea'
}

async function persistIdeaToLibrary(idea: ContentIdea): Promise<string | null> {
  try {
    const item = await createLibraryItem({
      essence_id: null,
      type: ideaToLibraryType(idea.type),
      title: idea.theme,
      content: idea.content,
      category: idea.objective || null,
      format: null,
      status: 'saved',
      source: 'ai',
      tags: idea.tags ?? [],
      metadata: {
        cta: idea.cta,
        timeEstimate: idea.timeEstimate,
        exposureLevel: idea.exposureLevel,
        content_type: idea.contentType ?? null,
        sequence_count: idea.sequenceCount ?? null,
        model: idea.model ?? null,
        media: idea.media ?? 'video',
        objective: idea.objectiveKey ?? null,
      },
      is_favorite: false,
    })
    return item.id
  } catch {
    return null
  }
}

// Salva a ideia na biblioteca REAPROVEITANDO o item existente quando há um
// (ex.: variações do mesmo conteúdo) — em vez de criar uma linha nova a cada
// clique. Sem isso, gerar 1 conteúdo + 4 variações deixava 5 itens quase iguais.
async function upsertIdeaToLibrary(idea: ContentIdea, existingId: string | null): Promise<string | null> {
  if (existingId) {
    try {
      await updateLibraryItem(existingId, {
        title: idea.theme,
        content: idea.content,
        category: idea.objective || null,
        status: 'saved',
        tags: idea.tags ?? [],
        metadata: {
          cta: idea.cta,
          timeEstimate: idea.timeEstimate,
          exposureLevel: idea.exposureLevel,
          content_type: idea.contentType ?? null,
          sequence_count: idea.sequenceCount ?? null,
          model: idea.model ?? null,
          media: idea.media ?? 'video',
          objective: idea.objectiveKey ?? null,
        },
      })
      return existingId
    } catch {
      // Se o update falhar (item removido, rede), cria um novo como fallback.
    }
  }
  return persistIdeaToLibrary(idea)
}

const CONTENT_TYPES = [
  { value: 'story', label: 'Story único', Icon: Smartphone, desc: 'Direto ao ponto' },
  { value: 'sequence', label: 'Sequência', Icon: LayoutList, desc: '2–10 stories' },
  { value: 'reel', label: 'Reels curto', Icon: Film, desc: 'Vídeo curto' },
] as const

type SelectOption<T extends string = string> = { value: T; label: string }

const OBJECTIVES: SelectOption<ContentObjective>[] = [
  { value: 'educate', label: 'Educar' },
  { value: 'connect', label: 'Aproximar' },
  { value: 'sell_service', label: 'Vender serviço' },
  { value: 'promote_product', label: 'Divulgar produto' },
  { value: 'answer_question', label: 'Responder dúvida' },
  { value: 'break_objection', label: 'Quebrar objeção' },
  { value: 'show_backstage', label: 'Mostrar bastidor' },
  { value: 'generate_interaction', label: 'Gerar interação' },
  { value: 'reactivate_audience', label: 'Reativar audiência' },
]

// Modelos de Story (story único / sequência) — estruturas típicas de stories.
const STORY_CONTENT_MODELS: SelectOption<ContentModel | ''>[] = [
  { value: '', label: 'Qualquer formato' },
  { value: 'question_box', label: 'Caixinha de perguntas' },
  { value: 'poll', label: 'Enquete' },
  { value: 'backstage', label: 'Bastidor comentado' },
  { value: 'myth_truth', label: 'Mito e verdade' },
  { value: 'quick_question', label: 'Dúvida rápida' },
  { value: 'soft_sell', label: 'Venda leve' },
  { value: 'objection_break', label: 'Quebra de objeção' },
]

// Modelos de Reels curto — pensados para VÍDEO objetivo (gancho → desenvolvimento
// → fechamento), e não estruturas de story como caixinha/enquete.
const REEL_CONTENT_MODELS: SelectOption<ContentModel | ''>[] = [
  { value: '', label: 'Qualquer formato' },
  { value: 'reel_quick_tip', label: 'Dica rápida' },
  { value: 'reel_tutorial', label: 'Tutorial / passo a passo' },
  { value: 'reel_before_after', label: 'Antes e depois' },
  { value: 'reel_top_list', label: 'Lista rápida (3 itens)' },
  { value: 'reel_mini_story', label: 'Mini história' },
  { value: 'myth_truth', label: 'Mito x verdade' },
  { value: 'reel_trend', label: 'Gancho de tendência' },
]

// Formato de mídia: mantém os dois caminhos de negócio existentes (video/photo),
// mas apresenta três escolhas mais humanas na UI.
const MEDIA_OPTIONS: { id: 'video' | 'photo' | 'text'; value: ContentMedia; label: string; Icon: typeof Camera; desc: string }[] = [
  { id: 'video', value: 'video', label: 'Vou aparecer falando', Icon: Camera, desc: 'Roteiro para gravar' },
  { id: 'photo', value: 'photo', label: 'Vou postar foto ou bastidor', Icon: Image, desc: 'Imagem com texto' },
  { id: 'text', value: 'photo', label: 'Quero só texto na tela', Icon: FileText, desc: 'Sem aparecer' },
]

// Rascunho da aba Criar guardado na sessão. Mantém os roteiros gerados e a
// configuração enquanto o usuário está no fluxo (abre o teleprompter, navega e
// volta) — sem isso, ao remontar a página os roteiros sumiam. sessionStorage:
// vive durante a sessão da aba e some ao fechar (não polui o armazenamento).
const DRAFT_KEY = 'destravai-criar-draft'
type CriarDraft = {
  result: ContentIdea | null
  activeTab: 'criar' | 'livre' | 'roteiro' | 'ctas'
  contentType: 'story' | 'sequence' | 'reel'
  media: ContentMedia
  theme: string
  objective: ContentObjective | ''
  model: ContentModel | ''
  sequenceCountMode: string
}
function loadDraft(): Partial<CriarDraft> {
  try { return JSON.parse(sessionStorage.getItem(DRAFT_KEY) ?? '{}') } catch { return {} }
}

function saveDraftPatch(patch: Partial<CriarDraft>) {
  try {
    const current = loadDraft()
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ ...current, ...patch }))
  } catch {
    console.warn('[Criar] não foi possível atualizar o rascunho')
  }
}

type CreateGenerationOutcome =
  | { id: string; idea: ContentIdea; libraryItemId: string | null }
  | { id: string; error: ContentIdea }

let pendingCreateGeneration: { id: string; promise: Promise<CreateGenerationOutcome> } | null = null

function clearPendingCreateGeneration(id: string) {
  if (pendingCreateGeneration?.id === id) pendingCreateGeneration = null
}

// Quantidade de stories/fotos: opções diretas de 2 a 10 (sem "personalizado").
const SEQUENCE_COUNT_OPTIONS: SelectOption[] = Array.from({ length: 9 }, (_, i) => {
  const n = String(i + 2)
  return { value: n, label: n }
})

const TIME_OPTIONS: SelectOption[] = [
  { value: '2 minutos', label: '2 minutos' },
  { value: '5 minutos', label: '5 minutos' },
  { value: '10 minutos', label: '10 minutos' },
  { value: '15 minutos', label: '15 minutos' },
  { value: '30 minutos', label: '30 minutos' },
]

const CTA_TYPE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  interaction: { bg: 'rgba(109,93,246,0.08)', border: 'rgba(109,93,246,0.2)', text: '#9B8CFF' },
  save: { bg: 'rgba(83,214,161,0.08)', border: 'rgba(83,214,161,0.2)', text: '#53D6A1' },
  schedule: { bg: 'rgba(247,185,85,0.08)', border: 'rgba(247,185,85,0.2)', text: '#F7B955' },
  'soft-sell': { bg: 'rgba(255,122,107,0.08)', border: 'rgba(255,122,107,0.2)', text: '#FF7A6B' },
  'question-box': { bg: 'rgba(155,140,255,0.08)', border: 'rgba(155,140,255,0.2)', text: '#9B8CFF' },
}

function DarkSelect<T extends string>({ label, options, value, onChange, placeholder }: {
  label: string; options: SelectOption<T>[]; value: T | ''; onChange: (v: T | '') => void; placeholder?: string
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="relative">
        <select value={value} onChange={e => onChange(e.target.value as T | '')} className="input appearance-none pr-10">
          {placeholder && <option value="">{placeholder}</option>}
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
      </div>
    </div>
  )
}

// Modal de legenda
function CaptionModal({ caption, hashtags, onClose }: { caption: string; hashtags: string[]; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const fullText = caption + '\n\n' + hashtags.join(' ')

  const handleCopy = () => {
    navigator.clipboard.writeText(fullText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-[150] flex flex-col justify-end"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="rounded-t-3xl p-5 pb-10 space-y-4 max-h-[80vh] overflow-y-auto"
        style={{ background: 'var(--bg-card)', borderTop: '1px solid var(--border-color)' }}>
        <div className="flex items-center justify-between">
          <p className="font-extrabold text-base" style={{ color: 'var(--text-primary)' }}>📝 Legenda gerada</p>
          <button onClick={onClose} style={{ color: 'var(--text-muted)' }}><X size={18} /></button>
        </div>
        <div className="rounded-2xl p-4 space-y-3" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)' }}>
          <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: 'var(--text-primary)' }}>{caption}</p>
          <p className="text-xs leading-relaxed" style={{ color: '#9B8CFF' }}>{hashtags.join(' ')}</p>
        </div>
        <button onClick={handleCopy} className="btn-primary w-full py-3 text-sm"
          style={copied ? { background: 'var(--success)' } : {}}>
          {copied ? <><Check size={14} /> Copiado!</> : <><Copy size={14} /> Copiar texto</>}
        </button>
      </div>
    </div>
  )
}

// CTAs personalizados pela IA
function PersonalizedCTABrowser() {
  const { state } = useApp()
  const profile = state.localProfile
  const [ctas, setCtas] = useState<Array<{ text: string; type: string; typeLabel: string }>>([])
  const [loading, setLoading] = useState(false)
  const [generated, setGenerated] = useState(false)

  const handleGenerate = async () => {
    if (!profile) return
    setLoading(true)
    try {
      const result = await generatePersonalizedCTAs(profile)
      setCtas(result)
      setGenerated(true)
    } catch {
      // fallback silencioso
    } finally {
      setLoading(false)
    }
  }

  if (!generated) {
    return (
      <div className="space-y-4">
        <div className="app-card rounded-2xl p-5 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto"
            style={{ background: 'var(--brand-soft)', border: '1px solid var(--brand-border)' }}>
            <Zap size={22} style={{ color: 'var(--brand)' }} />
          </div>
          <p className="font-extrabold text-base" style={{ color: 'var(--text-primary)' }}>CTAs do seu jeito</p>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            A Deby gera chamadas para ação com o seu tom de voz, área e serviços — não uma lista genérica.
          </p>
          <button
            onClick={handleGenerate}
            disabled={loading || !profile}
            className="btn-primary w-full py-3 text-sm disabled:opacity-40"
          >
            {loading
              ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Gerando...</>
              : <><Sparkles size={15} /> Gerar meus CTAs personalizados</>}
          </button>
          {!profile && (
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Complete sua Essência primeiro</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
          {ctas.length} CTAs gerados para {profile?.professionalName?.split(' ')[0]}
        </p>
        <button onClick={handleGenerate} disabled={loading} className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl"
          style={{ background: 'var(--bg-card-bright)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}>
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''} /> Gerar novos
        </button>
      </div>
      {ctas.map((cta, i) => {
        const colors = CTA_TYPE_COLORS[cta.type] ?? CTA_TYPE_COLORS.interaction
        return <CTACard key={i} text={cta.text} typeLabel={cta.typeLabel} colors={colors} />
      })}
    </div>
  )
}

function CTACard({ text, typeLabel, colors }: { text: string; typeLabel: string; colors: { bg: string; border: string; text: string } }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="rounded-2xl p-4 flex flex-col gap-3" style={{ background: colors.bg, border: `1px solid ${colors.border}` }}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full"
          style={{ background: colors.bg, border: `1px solid ${colors.border}`, color: colors.text }}>
          {typeLabel}
        </span>
        <button
          onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
          className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl transition-all"
          style={copied
            ? { background: 'rgba(83,214,161,0.15)', color: '#53D6A1', border: '1px solid rgba(83,214,161,0.3)' }
            : { background: 'var(--bg-card-bright)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}>
          {copied ? <><Check size={11} /> Copiado</> : <><Copy size={11} /> Copiar</>}
        </button>
      </div>
      <p className="text-sm font-semibold leading-relaxed" style={{ color: 'var(--text-primary)' }}>{text}</p>
    </div>
  )
}

export default function Criar() {
  const { state, addIdea, updateIdea } = useApp()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  useScreenTour('criar')

  const paramType = searchParams.get('type') as 'story' | 'sequence' | 'reel' | null
  const paramTheme = searchParams.get('theme') ?? ''
  const paramObjective = searchParams.get('objective') ?? ''
  const initialObjective = OBJECTIVES.find(o => o.value === paramObjective || o.label === paramObjective)?.value ?? ''

  // Rascunho salvo da sessão — restaura roteiros/config ao remontar a página
  // (ex.: voltar do teleprompter). Parâmetros da URL (deep link da Home) têm
  // prioridade quando presentes.
  const draft = loadDraft()

  const [activeTab, setActiveTab] = useState<'criar' | 'livre' | 'roteiro' | 'ctas'>(draft.activeTab ?? 'criar')
  const [contentType, setContentType] = useState<'story' | 'sequence' | 'reel'>(paramType ?? draft.contentType ?? 'story')
  const [media, setMedia] = useState<ContentMedia>(draft.media ?? 'video')
  const [postMode, setPostMode] = useState<'video' | 'photo' | 'text'>(draft.media === 'photo' ? 'photo' : 'video')
  const [sequenceCountMode, setSequenceCountMode] = useState(draft.sequenceCountMode ?? '3')
  const [theme, setTheme] = useState(paramTheme || draft.theme || '')
  const [objective, setObjective] = useState<ContentObjective | ''>(initialObjective || draft.objective || '')
  const [model, setModel] = useState<ContentModel | ''>(draft.model ?? '')
  const [timeAvailable, setTimeAvailable] = useState('5 minutos')
  const [loading, setLoading] = useState(() => !!pendingCreateGeneration)
  const [result, setResult] = useState<ContentIdea | null>(draft.result ?? null)
  const [showStudio, setShowStudio] = useState(false)
  // Ideia efetivamente enviada ao teleprompter. Para sequência, é UM story
  // específico; senão, é o próprio result.
  const [studioIdea, setStudioIdea] = useState<ContentIdea | null>(null)
  const [showVoice, setShowVoice] = useState(false)

  // Momento livre (tema do momento, fora do nicho, tom leve)
  const [freeTopic, setFreeTopic] = useState('')
  const [freeVibe, setFreeVibe] = useState('leve e pessoal')
  const [showFreeVoice, setShowFreeVoice] = useState(false)
  // Meu roteiro (texto escrito pela própria pessoa → grava direto)
  const [ownScript, setOwnScript] = useState('')
  const [ownTheme, setOwnTheme] = useState('')
  const [showOwnVoice, setShowOwnVoice] = useState(false)
  const [captionData, setCaptionData] = useState<{ caption: string; hashtags: string[] } | null>(null)
  const [captionLoading, setCaptionLoading] = useState(false)
  const [libraryItemId, setLibraryItemId] = useState<string | null>(null)
  const [savedNotice, setSavedNotice] = useState(false)
  const [photoComposer, setPhotoComposer] = useState<{ text: string; title: string } | null>(null)
  const mountedRef = useRef(true)
  const appliedGenerationRef = useRef<string | null>(null)

  const profile = state.localProfile
  const themeOptions = [
    ...(profile?.pillars.map(p => p.name) ?? []),
    ...(profile?.services.map(s => s.name) ?? []),
    'Bastidor do dia', 'Dúvida frequente', 'Mito e verdade', 'Rotina de trabalho',
  ]
  // Reels curto tem seus próprios modelos (vídeo objetivo); story/sequência usam
  // os modelos clássicos de stories.
  const contentModels = contentType === 'reel' ? REEL_CONTENT_MODELS : STORY_CONTENT_MODELS
  const selectedObjectiveLabel = OBJECTIVES.find(o => o.value === objective)?.label ?? ''
  const selectedModelLabel = contentModels.find(o => o.value === model)?.label ?? ''
  const structuredContentType = contentType === 'sequence' ? 'story_sequence' : contentType === 'reel' ? 'short_reel' : 'single_story'
  const sequenceCount = contentType === 'sequence'
    ? Math.min(10, Math.max(2, Number(sequenceCountMode) || 3))
    : null

  const applyGenerationOutcome = (outcome: CreateGenerationOutcome) => {
    if (!mountedRef.current || appliedGenerationRef.current === outcome.id) return
    appliedGenerationRef.current = outcome.id
    setLoading(false)

    if ('idea' in outcome) {
      setResult(outcome.idea)
      addIdea(outcome.idea)
      setLibraryItemId(outcome.libraryItemId)
      if (outcome.libraryItemId) {
        setSavedNotice(true)
        setTimeout(() => { if (mountedRef.current) setSavedNotice(false) }, 2500)
      }
      return
    }

    setResult(outcome.error)
  }

  useEffect(() => {
    mountedRef.current = true
    const pending = pendingCreateGeneration
    if (pending) {
      setLoading(true)
      pending.promise.then(applyGenerationOutcome)
    }
    return () => { mountedRef.current = false }
  }, [])

  const startPersistentGeneration = (
    factory: () => Promise<ContentIdea>,
    snapshot: Partial<CriarDraft>,
    createError: (message: string) => ContentIdea,
  ) => {
    if (pendingCreateGeneration) {
      setLoading(true)
      pendingCreateGeneration.promise.then(applyGenerationOutcome)
      return
    }

    const id = crypto.randomUUID()
    setLoading(true)
    setResult(null)

    const promise = (async (): Promise<CreateGenerationOutcome> => {
      try {
        const idea = await factory()
        const savedId = await persistIdeaToLibrary(idea)
        saveDraftPatch({ ...snapshot, result: idea })
        return { id, idea, libraryItemId: savedId }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        const error = createError(msg)
        saveDraftPatch({ ...snapshot, result: error })
        return { id, error }
      } finally {
        clearPendingCreateGeneration(id)
      }
    })()

    pendingCreateGeneration = { id, promise }
    promise.then(applyGenerationOutcome)
  }

  // Persiste o rascunho (roteiros + configuração) na sessão a cada mudança, para
  // sobreviver à remontagem da página ao navegar/voltar do teleprompter.
  useEffect(() => {
    // Não persiste telas de ERRO: senão o card "Erro na geração" ressuscita ao
    // voltar do teleprompter, como se fosse conteúdo.
    const safeResult = result && result.id !== 'error' ? result : null
    const next: CriarDraft = { result: safeResult, activeTab, contentType, media, theme, objective, model, sequenceCountMode }
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(next))
    } catch {
      // Cota cheia: o que NÃO pode se perder ao navegar/voltar é o roteiro gerado.
      // Tenta de novo guardando só o essencial (a config é leve de refazer).
      try {
        sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ result: safeResult, activeTab, contentType, media }))
      } catch {
        console.warn('[Criar] não foi possível salvar o rascunho (sessionStorage cheio)')
      }
    }
  }, [result, activeTab, contentType, media, theme, objective, model, sequenceCountMode])

  const handleGenerate = async (variationHint?: string) => {
    if (!profile || loading) return // trava corrida: ignora clique enquanto gera
    const snapshot: Partial<CriarDraft> = { activeTab, contentType, media, theme, objective, model, sequenceCountMode }
    startPersistentGeneration(
      () => generateContent({
        type: contentType,
        contentType: structuredContentType,
        sequenceCount,
        // Reels é sempre vídeo; story/sequência respeitam a escolha de mídia.
        media: contentType === 'reel' ? 'video' : media,
        theme: theme || (profile.pillars[0]?.name ?? profile.specialty ?? 'Conteúdo relevante'),
        objective: objective || 'educate',
        objectiveLabel: selectedObjectiveLabel
          ? (variationHint ? `${selectedObjectiveLabel} — ${variationHint}` : selectedObjectiveLabel)
          : (variationHint ? `Conteúdo relevante e executável — ${variationHint}` : 'Conteúdo relevante e executável'),
        model: model || null,
        format: selectedModelLabel,
        exposureLevel: profile.exposureLevel,
        timeAvailable,
        tone: profile.voiceTone,
        profile,
      }),
      snapshot,
      (msg) => {
        console.error('[Criar generateContent]', msg)
        return { id: 'error', type: contentType, theme: 'Erro na geração', objective: '', content: `Falha ao gerar conteúdo:\n\n${msg}`, cta: '', timeEstimate: '', exposureLevel: profile?.exposureLevel ?? 'no-appearance', status: 'pending', favorite: false, createdAt: new Date().toISOString(), tags: [] }
      },
    )
  }

  const handleVariation = async (hint: string) => {
    if (!profile || !result || loading) return // trava corrida entre variações
    setLoading(true)
    try {
      const idea = await generateContent({
        type: result.type,
        contentType: result.contentType,
        sequenceCount: result.sequenceCount,
        media: result.media ?? 'video',
        theme: result.theme,
        objective: result.objectiveKey || 'educate',
        objectiveLabel: `${result.objective} — ${hint}`,
        model: result.model ?? null,
        exposureLevel: profile.exposureLevel,
        timeAvailable: result.timeEstimate,
        tone: profile.voiceTone, profile,
      })
      setResult(idea); addIdea(idea)
      // Variação substitui o mesmo item na biblioteca (não cria duplicata).
      const id = await upsertIdeaToLibrary(idea, libraryItemId)
      setLibraryItemId(id)
      if (id) { setSavedNotice(true); setTimeout(() => setSavedNotice(false), 2500) }
    } finally { setLoading(false) }
  }

  const handleCaption = async () => {
    if (!profile || !result) return
    setCaptionLoading(true)
    try {
      const data = await generateCaption(result, profile)
      setCaptionData(data)
    } catch {
      // silencioso
    } finally {
      setCaptionLoading(false)
    }
  }

  // Momento livre: gera um story leve sobre o que a pessoa quer falar agora.
  const handleGenerateFree = async () => {
    if (!profile || !freeTopic.trim() || loading) return // trava corrida
    const snapshot: Partial<CriarDraft> = { activeTab: 'livre', contentType: 'story', media: 'video', theme: freeTopic.trim(), objective: '', model: '', sequenceCountMode }
    startPersistentGeneration(
      () => generateFreeStory(profile, freeTopic.trim(), freeVibe),
      snapshot,
      (msg) => {
        console.error('[Criar generateFree]', msg)
        return { id: 'error', type: 'story', theme: 'Erro na geração', objective: '', content: `Falha ao gerar:\n\n${msg}`, cta: '', timeEstimate: '', exposureLevel: profile?.exposureLevel ?? 'no-appearance', status: 'pending', favorite: false, createdAt: new Date().toISOString(), tags: [] }
      },
    )
  }

  // Meu roteiro: usa o texto da própria pessoa e abre o teleprompter direto.
  const handleOwnScript = async () => {
    if (!ownScript.trim()) return
    const idea = ideaFromOwnScript(ownScript, {
      theme: ownTheme,
      exposureLevel: profile?.exposureLevel,
    })
    setResult(idea); addIdea(idea)
    setStudioIdea(idea)
    setShowStudio(true)
    const id = await persistIdeaToLibrary(idea)
    setLibraryItemId(id)
    if (id) { setSavedNotice(true); setTimeout(() => setSavedNotice(false), 2500) }
  }

  return (
    <div className="p-5 space-y-6 pb-28">
      <div className="pt-4">
        <h1 className="premium-title">Criar</h1>
        <p className="premium-subtitle">
          Escolha o formato e deixe o Destravaí montar o caminho.
        </p>
      </div>

      {/* Atalho para a Essência quando incompleta — roteiros ficam muito mais
          personalizados com ela preenchida. (Essência saiu da navbar.) */}
      {!profile?.pillars?.length && (
        <button onClick={() => navigate('/essencia')}
          className="w-full list-item text-left">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(245,158,11,0.14)', border: '1px solid rgba(245,158,11,0.28)' }}>
            <Star size={17} style={{ color: 'var(--warning)' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Melhore sua Essência</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              Roteiros ficam muito mais personalizados quando você preenche sua Essência.
            </p>
          </div>
          <ChevronRight size={16} style={{ color: '#F7B955', flexShrink: 0 }} />
        </button>
      )}

      {/* Tab switcher — 3 abas principais (ações do dia a dia). CTAs saíram daqui
          para não disputar espaço: viraram uma entrada secundária no fim do Roteiro. */}
      <div className="segmented-control" data-tour="criar-tabs">
        {([
          { key: 'criar', label: 'Roteiro', Icon: Sparkles },
          { key: 'livre', label: 'Momento livre', Icon: Coffee },
          { key: 'roteiro', label: 'Meu roteiro', Icon: PenLine },
        ] as const).map(({ key, label, Icon }) => (
          <button
            key={key}
            type="button"
            data-active={activeTab === key}
            onClick={() => setActiveTab(key)}
            className="flex items-center justify-center gap-1.5 whitespace-nowrap"
          >
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      {activeTab === 'ctas' && (
        <div className="space-y-3">
          <button onClick={() => setActiveTab('criar')} className="flex items-center gap-1.5 text-sm font-bold" style={{ color: '#9B8CFF' }}>
            <ChevronLeft size={16} /> Voltar para Roteiro
          </button>
          <PersonalizedCTABrowser />
        </div>
      )}

      {/* ── Aba: Momento livre ── */}
      {activeTab === 'livre' && <>
        <div className="app-card rounded-2xl p-5 space-y-1">
          <p className="font-extrabold text-base flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <Coffee size={16} style={{ color: 'var(--warning)' }} /> Fala o que está na sua cabeça
          </p>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Um tema do momento, mesmo fora da sua área (uma opinião, um desabafo, algo do dia). A Deby mantém a sua voz, com tom leve — sem forçar venda.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="label">Sobre o que você quer falar agora?</label>
            <div className="relative">
              <textarea
                className="input resize-none pr-12"
                rows={3}
                value={freeTopic}
                onChange={e => setFreeTopic(e.target.value)}
                placeholder="Ex: minha opinião sobre o debate de ontem, por que parei de tomar café, o que aprendi num perrengue hoje..."
              />
              <button
                onClick={() => setShowFreeVoice(true)}
                className="absolute right-3 top-3 w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-90"
                style={{ background: 'rgba(109,93,246,0.15)', border: '1px solid rgba(109,93,246,0.25)' }}
                title="Ditar por voz" type="button"
              >
                <Mic size={14} style={{ color: '#9B8CFF' }} />
              </button>
            </div>
          </div>

          <div>
            <label className="label">Estilo</label>
            <div className="flex flex-wrap gap-1.5">
              {['leve e pessoal', 'com humor', 'opinião sincera', 'reflexivo', 'desabafo real'].map(v => (
                <button key={v} onClick={() => setFreeVibe(v)}
                  className={`chip text-xs ${freeVibe === v ? 'chip-active' : 'chip-inactive'}`}>{v}</button>
              ))}
            </div>
          </div>
        </div>

        <button
          onClick={handleGenerateFree}
          disabled={loading || !profile || !freeTopic.trim()}
          className="btn-primary w-full py-4 text-base disabled:opacity-40"
        >
          {loading
            ? <><span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Criando seu story...</>
            : <><Coffee size={18} /> Criar story do momento</>}
        </button>
        {!profile && (
          <div className="rounded-2xl p-4 text-sm font-semibold text-center"
            style={{ background: 'rgba(247,185,85,0.1)', border: '1px solid rgba(247,185,85,0.2)', color: '#F7B955' }}>
            Complete o onboarding para a Deby conhecer a sua voz.
          </div>
        )}
      </>}

      {/* ── Aba: Meu roteiro (texto próprio → teleprompter) ── */}
      {activeTab === 'roteiro' && <>
        <div className="app-card rounded-2xl p-5 space-y-1">
          <p className="font-extrabold text-base flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <PenLine size={16} style={{ color: 'var(--success)' }} /> Já tenho o que falar
          </p>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Escreva ou cole o seu próprio roteiro e vá direto para o teleprompter gravar. Sem a Deby — do seu jeito.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="label">Título (opcional)</label>
            <input className="input" value={ownTheme} onChange={e => setOwnTheme(e.target.value)} placeholder="Como você quer chamar este roteiro" />
          </div>
          <div>
            <label className="label">Seu roteiro</label>
            <div className="relative">
              <textarea
                className="input resize-none pr-12"
                rows={8}
                value={ownScript}
                onChange={e => setOwnScript(e.target.value)}
                placeholder="Escreva exatamente o que você vai falar. O teleprompter vai exibir esse texto enquanto você grava."
              />
              <button
                onClick={() => setShowOwnVoice(true)}
                className="absolute right-3 top-3 w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-90"
                style={{ background: 'rgba(109,93,246,0.15)', border: '1px solid rgba(109,93,246,0.25)' }}
                title="Ditar por voz" type="button"
              >
                <Mic size={14} style={{ color: '#9B8CFF' }} />
              </button>
            </div>
            <p className="text-[11px] mt-1.5" style={{ color: 'var(--text-muted)' }}>
              Dica: cada linha vira um trecho no teleprompter.
            </p>
          </div>
        </div>

        <button
          onClick={handleOwnScript}
          disabled={!ownScript.trim()}
          className="btn-primary w-full py-4 text-base disabled:opacity-40"
        >
          <Camera size={18} /> Gravar meu roteiro
        </button>
      </>}

      {activeTab === 'criar' && <>
        {/* Type selector */}
        <div className="grid grid-cols-3 gap-2">
          {CONTENT_TYPES.map(({ value, label, Icon, desc }) => (
            <button
              key={value}
              onClick={() => {
                setContentType(value)
                setResult(null)
                // Modelos diferem entre Reels e Stories → zera o modelo ao trocar.
                setModel('')
                // Reels é sempre vídeo (não tem opção de foto).
                if (value === 'reel') {
                  setMedia('video')
                  setPostMode('video')
                }
              }}
              className="rounded-2xl p-3.5 text-center transition-all duration-300 active:scale-95"
              style={contentType === value ? {
                background: 'var(--brand-soft)',
                border: '1px solid var(--brand-border)',
              } : {
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div className="flex justify-center mb-2">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={contentType === value
                    ? { background: 'var(--brand-soft)', border: '1px solid var(--brand-border)' }
                    : { background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                  <Icon size={18} style={{ color: contentType === value ? 'var(--brand)' : 'var(--text-muted)' }} />
                </div>
              </div>
              <span className="block text-sm font-extrabold" style={{ color: contentType === value ? 'var(--brand)' : 'var(--text-primary)' }}>{label}</span>
              <span className="block text-[10px] font-medium mt-0.5" style={{ color: 'var(--text-muted)' }}>{desc}</span>
            </button>
          ))}
        </div>

        {/* Formato de mídia: vídeo (gravar falando) ou foto (postar foto/fotos sem
            gravar). Só para story/sequência — Reels é sempre vídeo. Permite criar
            conteúdo mesmo sem querer aparecer falando. */}
        {contentType !== 'reel' && (
          <div>
            <label className="label">Como vai postar</label>
            <div className="grid grid-cols-3 gap-2">
              {MEDIA_OPTIONS.map(({ id, value, label, Icon, desc }) => {
                const active = postMode === id
                return (
                  <button
                    key={id}
                    onClick={() => { setMedia(value); setPostMode(id); setResult(null) }}
                    className="rounded-[18px] p-2.5 flex flex-col items-start gap-2 text-left transition-all active:scale-[0.98] min-h-[112px]"
                    style={active
                      ? { background: 'rgba(124,92,255,0.12)', border: '1px solid rgba(124,92,255,0.45)' }
                      : { background: 'var(--interactive-bg)', border: '1px solid var(--interactive-border)' }}
                  >
                    <div className="w-8 h-8 rounded-[14px] flex items-center justify-center flex-shrink-0"
                      style={active
                        ? { background: 'rgba(124,92,255,0.18)' }
                        : { background: 'var(--interactive-bg-strong)' }}>
                      <Icon size={15} style={{ color: active ? '#9B8CFF' : 'var(--text-muted)' }} />
                    </div>
                    <div className="min-w-0">
                      <span className="block text-[12px] leading-snug font-extrabold" style={{ color: active ? '#9B8CFF' : 'var(--text-primary)' }}>{label}</span>
                      <span className="block text-[10px] leading-snug font-medium mt-1" style={{ color: 'var(--text-muted)' }}>{desc}</span>
                    </div>
                  </button>
                )
              })}
            </div>
            {media === 'photo' && (
              <p className="text-[11px] mt-1.5" style={{ color: 'var(--text-muted)' }}>
                A Deby vai sugerir o que fotografar + texto na tela e legenda. Sem precisar gravar falando.
              </p>
            )}
          </div>
        )}

        {/* Config fields */}
        <div className="space-y-4">
          <div>
            <label className="label">Tema</label>
            <div className="relative mb-2">
              <input
                className="input pr-12"
                value={theme}
                onChange={e => setTheme(e.target.value)}
                placeholder="Digite ou fale o tema..."
              />
              <button
                onClick={() => setShowVoice(true)}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-90"
                style={{ background: 'rgba(109,93,246,0.15)', border: '1px solid rgba(109,93,246,0.25)' }}
                title="Ditar tema por voz"
                type="button"
              >
                <Mic size={14} style={{ color: '#9B8CFF' }} />
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {themeOptions.slice(0, 6).map(t => (
                <button key={t} onClick={() => setTheme(t)}
                  className={`chip text-xs ${theme === t ? 'chip-active' : 'chip-inactive'}`}>{t}</button>
              ))}
            </div>
          </div>

          <DarkSelect label="Objetivo" options={OBJECTIVES} value={objective} onChange={setObjective} placeholder="Selecione o objetivo..." />
          {contentType === 'sequence' && (
            <DarkSelect label={media === 'photo' ? 'Quantidade de fotos' : 'Quantidade de stories'} options={SEQUENCE_COUNT_OPTIONS} value={sequenceCountMode} onChange={setSequenceCountMode} />
          )}
          <DarkSelect
            label="Modelo"
            options={contentModels}
            value={model}
            onChange={setModel}
          />
          {contentType === 'reel' && (
            <p className="text-[11px] -mt-2" style={{ color: 'var(--text-muted)' }}>
              Formatos pensados para vídeo curto: gancho → desenvolvimento → fechamento.
            </p>
          )}
          {postMode !== 'photo' && (
            <DarkSelect label="Tempo disponível" options={TIME_OPTIONS} value={timeAvailable} onChange={setTimeAvailable} />
          )}
        </div>

        {/* Generate button */}
        <button
          onClick={() => handleGenerate()}
          disabled={loading || !profile}
          className="btn-tonal w-full py-4 text-base disabled:opacity-40"
        >
          {loading ? (
            <>
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Destravando ideia...
            </>
          ) : (
            <><Sparkles size={18} /> Destravar ideia</>
          )}
        </button>

        {/* Aviso amigavel durante a geracao: a IA leva ~20-30s e o spinner sozinho
            passa sensacao de travado. A mensagem segura a expectativa do usuario. */}
        {loading && (
          <p className="text-xs text-center mt-2" style={{ color: 'var(--text-secondary)' }}>
            Criando sua ideia com a Deby AI... Costuma levar de 20 a 30 segundos.
          </p>
        )}

        {!profile && (
          <div className="rounded-2xl p-4 text-sm font-semibold text-center"
            style={{ background: 'rgba(247,185,85,0.1)', border: '1px solid rgba(247,185,85,0.2)', color: '#F7B955' }}>
            Complete o onboarding para gerar conteúdo personalizado.
          </div>
        )}

        {/* Entrada secundária para CTAs — saiu das abas principais para não poluir
            a barra superior; quem precisar de só um CTA acessa por aqui. */}
        <button onClick={() => setActiveTab('ctas')}
          className="w-full rounded-2xl p-3.5 flex items-center gap-3 text-left transition-all active:scale-[0.99]"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(109,93,246,0.12)', border: '1px solid rgba(109,93,246,0.2)' }}>
            <Zap size={15} style={{ color: '#9B8CFF' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Só precisa de um CTA?</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Gere chamadas para ação no seu tom.</p>
          </div>
          <ChevronRight size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        </button>

      </>}

      {/* Resultado da IA — vale para 'Roteiro' e 'Momento livre' */}
      {(activeTab === 'criar' || activeTab === 'livre') && <>
        {result && !loading && result.id !== 'error' && (
          <button
            onClick={() => navigate('/espaco', { state: { tab: 'biblioteca' } })}
            className="flex items-center justify-center gap-1.5 text-xs font-semibold -mb-1 mx-auto hover:underline"
            style={{ color: savedNotice ? '#53D6A1' : 'var(--text-muted)' }}>
            <Check size={12} /> {savedNotice ? 'Salvo!' : 'Salvo automaticamente'} na Biblioteca (em Espaço) · ver
          </button>
        )}

        {/* Mantém o card visível DURANTE a variação (com os botões travados via
            busy) — antes ele sumia e o conteúdo "piscava". Geração nova zera o
            result, então aí o card fica oculto e o spinner é o do botão principal.
            key={result.id} remonta o card a cada ideia (estado limpo de "salvo"). */}
        {result && (
          <ScriptCard
            key={result.id}
            idea={result}
            busy={loading}
            onVariation={handleVariation}
            onSave={() => {
              updateIdea(result.id, { favorite: true })
              if (libraryItemId) updateLibraryItem(libraryItemId, { is_favorite: true }).catch(() => {})
            }}
            onCopy={() => {}}
            onRecord={(override) => { setStudioIdea(override ?? result); setShowStudio(true) }}
            onCreatePhoto={(text, targetIdea) => setPhotoComposer({ text, title: targetIdea.theme })}
            onCaption={handleCaption}
            onUpdate={(updated) => {
              // Reflete a edição na hora (card + teleprompter), no histórico local
              // e na biblioteca (persistência). O draft de sessão é salvo pelo
              // useEffect que observa `result`.
              setResult(updated)
              updateIdea(updated.id, { content: updated.content })
              if (libraryItemId) updateLibraryItem(libraryItemId, { content: updated.content }).catch(() => {})
            }}
          />
        )}

        {captionLoading && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}>
            <div className="flex flex-col items-center gap-3">
              <Sparkles size={28} style={{ color: '#9B8CFF' }} className="animate-pulse" />
              <p className="text-white font-bold text-sm">Gerando legenda...</p>
            </div>
          </div>
        )}

        {captionData && (
          <CaptionModal
            caption={captionData.caption}
            hashtags={captionData.hashtags}
            onClose={() => setCaptionData(null)}
          />
        )}
      </>}

      {showStudio && (studioIdea ?? result) && (
        <StudioModal idea={(studioIdea ?? result)!} onClose={() => { setShowStudio(false); setStudioIdea(null) }} />
      )}

      {photoComposer && (
        <PhotoTextComposer
          initialText={photoComposer.text}
          title={photoComposer.title}
          onClose={() => setPhotoComposer(null)}
        />
      )}

      {showVoice && (
        <VoiceDictation
          label="Fale o tema da sua ideia..."
          onResult={(text) => setTheme(text)}
          onClose={() => setShowVoice(false)}
        />
      )}

      {showFreeVoice && (
        <VoiceDictation
          label="Fale o que está na sua cabeça..."
          onResult={(text) => setFreeTopic(text)}
          onClose={() => setShowFreeVoice(false)}
        />
      )}

      {showOwnVoice && (
        <VoiceDictation
          label="Dite o seu roteiro..."
          onResult={(text) => setOwnScript(prev => (prev ? `${prev}\n${text}` : text))}
          onClose={() => setShowOwnVoice(false)}
        />
      )}
    </div>
  )
}
