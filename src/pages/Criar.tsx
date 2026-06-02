import { useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { Sparkles, RefreshCw, Copy, Check, Bookmark, ChevronDown, Zap, Camera, Mic, FileText, X, Smartphone, Film, LayoutList, PenLine, Coffee, Star, ChevronRight, ChevronLeft } from 'lucide-react'
import type { ContentIdea } from '../types'
import type { LibraryItemType } from '../lib/supabase/types'
import { generateContent, generateCaption, generatePersonalizedCTAs, generateFreeStory, ideaFromOwnScript } from '../lib/ai'
import { splitSequenceStories, stripStoryHeader } from '../lib/stories'
import { createLibraryItem, updateLibraryItem } from '../services/libraryService'
import StudioModal from '../components/StudioModal'
import VoiceDictation from '../components/VoiceDictation'

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
      metadata: { cta: idea.cta, timeEstimate: idea.timeEstimate, exposureLevel: idea.exposureLevel },
      is_favorite: false,
    })
    return item.id
  } catch {
    return null
  }
}

const CONTENT_TYPES = [
  { value: 'story', label: 'Story', Icon: Smartphone, desc: 'Direto ao ponto' },
  { value: 'sequence', label: 'Sequência', Icon: LayoutList, desc: '3–5 stories' },
  { value: 'reel', label: 'Reels', Icon: Film, desc: 'Vídeo curto' },
] as const

const OBJECTIVES = [
  'Educar', 'Aproximar', 'Vender serviço', 'Divulgar produto',
  'Responder dúvida', 'Quebrar objeção', 'Mostrar bastidor',
  'Gerar interação', 'Reativar audiência',
]

const FORMATS_STORY = [
  'Story único', 'Sequência de 3 stories', 'Sequência de 5 stories',
  'Caixinha de perguntas', 'Enquete', 'Bastidor comentado',
  'Mito e verdade', 'Dúvida rápida', 'Venda leve',
]

const FORMATS_REEL = [
  'Fala direta', 'No local de trabalho', 'Sentado(a)',
  'Com texto na tela', 'Respondendo dúvida', 'Mito rápido',
  'Lista curta', 'Humor leve', 'Gancho comercial', 'Bastidor estratégico',
]

const TIME_OPTIONS = ['2 minutos', '5 minutos', '10 minutos', '15 minutos', '30 minutos']

const VARIATION_LABELS = [
  { label: 'Mais simples', icon: '✨' },
  { label: 'Mais vendedor', icon: '💼' },
  { label: 'Com humor', icon: '😄' },
  { label: 'Sem aparecer', icon: '🖼️' },
  { label: 'Mais técnico', icon: '🔬' },
]

const CTA_TYPE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  interaction: { bg: 'rgba(109,93,246,0.08)', border: 'rgba(109,93,246,0.2)', text: '#9B8CFF' },
  save: { bg: 'rgba(83,214,161,0.08)', border: 'rgba(83,214,161,0.2)', text: '#53D6A1' },
  schedule: { bg: 'rgba(247,185,85,0.08)', border: 'rgba(247,185,85,0.2)', text: '#F7B955' },
  'soft-sell': { bg: 'rgba(255,122,107,0.08)', border: 'rgba(255,122,107,0.2)', text: '#FF7A6B' },
  'question-box': { bg: 'rgba(155,140,255,0.08)', border: 'rgba(155,140,255,0.2)', text: '#9B8CFF' },
}

function DarkSelect({ label, options, value, onChange, placeholder }: {
  label: string; options: string[]; value: string; onChange: (v: string) => void; placeholder?: string
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="relative">
        <select value={value} onChange={e => onChange(e.target.value)} className="input appearance-none pr-10">
          {placeholder && <option value="">{placeholder}</option>}
          {options.map(o => <option key={o} value={o}>{o}</option>)}
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
          style={copied ? { background: 'linear-gradient(135deg, #53D6A1, #3BB88A)', boxShadow: '0 0 20px rgba(83,214,161,0.4)' } : {}}>
          {copied ? <><Check size={14} /> Copiado!</> : <><Copy size={14} /> Copiar legenda + hashtags</>}
        </button>
      </div>
    </div>
  )
}

function ResultCard({ idea, onVariation, onSave, onCopy, onRecord, onCaption }: {
  idea: ContentIdea
  onVariation: (v: string) => void
  onSave: () => void
  onCopy: () => void
  // Aceita um override: ao gravar UM story específico de uma sequência, passamos
  // a ideia derivada (só aquele story). Sem override, grava a ideia inteira.
  onRecord: (override?: ContentIdea) => void
  onCaption: () => void
}) {
  const [copied, setCopied] = useState(false)
  const [saved, setSaved] = useState(idea.favorite)

  // Sequência → quebra em stories individuais, para ler e gravar 1 a 1.
  const stories = idea.type === 'sequence' ? splitSequenceStories(idea.content) : []
  const isMultiStory = stories.length > 1

  const handleCopy = () => {
    navigator.clipboard.writeText(idea.content + (idea.cta ? `\n\nCTA: ${idea.cta}` : ''))
    setCopied(true); onCopy()
    setTimeout(() => setCopied(false), 2000)
  }
  const handleSave = () => { setSaved(true); onSave() }

  return (
    <div className="space-y-4 animate-fade-up">
      <div
        className="relative rounded-3xl overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, rgba(109,93,246,0.12), rgba(155,140,255,0.06))',
          border: '1px solid rgba(109,93,246,0.25)',
          boxShadow: '0 0 40px rgba(109,93,246,0.1), 0 8px 32px rgba(0,0,0,0.4)',
        }}
      >
        <div className="absolute top-0 left-0 right-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(109,93,246,0.7), transparent)' }} />

        <div className="p-5">
          <div className="flex flex-wrap gap-1.5 mb-3">
            <span className="tag tag-purple capitalize">
              {idea.type === 'story' ? 'Story' : idea.type === 'sequence' ? 'Sequência' : 'Reels'}
            </span>
            <span className="tag tag-amber">{idea.timeEstimate}</span>
          </div>

          <h3 className="font-extrabold text-lg mb-4" style={{ color: 'var(--text-primary)' }}>{idea.theme}</h3>

          {isMultiStory ? (
            <div className="space-y-3 mb-3">
              <p className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                Sequência de {stories.length} stories. Grave um de cada vez:
              </p>
              {stories.map((story, i) => {
                const body = stripStoryHeader(story)
                // Ideia derivada SÓ deste story → vai para o teleprompter sozinha.
                const storyIdea: ContentIdea = {
                  ...idea,
                  id: `${idea.id}-s${i + 1}`,
                  type: 'story',
                  theme: `Story ${i + 1} — ${idea.theme}`,
                  content: body,
                }
                return (
                  <div key={i} className="rounded-2xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="tag tag-purple text-[10px]">Story {i + 1} de {stories.length}</span>
                      <button onClick={() => onRecord(storyIdea)}
                        className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full"
                        style={{ background: 'linear-gradient(135deg, #6D5DF6, #9B8CFF)', color: '#fff' }}>
                        <Camera size={12} /> Gravar este
                      </button>
                    </div>
                    <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                      {body}
                    </pre>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="rounded-2xl p-4 mb-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
              <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                {idea.content}
              </pre>
            </div>
          )}

          {idea.cta && (
            <div className="rounded-2xl p-3 mb-4" style={{ background: 'rgba(255,122,107,0.08)', border: '1px solid rgba(255,122,107,0.2)' }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#FF7A6B' }}>CTA</p>
              <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{idea.cta}</p>
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={handleCopy} className="btn-primary flex-1 py-2.5 text-sm"
              style={copied ? { background: 'linear-gradient(135deg, #53D6A1, #3BB88A)', boxShadow: '0 0 20px rgba(83,214,161,0.4)' } : {}}>
              {copied ? <><Check size={14} /> Copiado!</> : <><Copy size={14} /> Copiar roteiro</>}
            </button>
            <button onClick={onCaption} className="btn-secondary py-2.5 px-3.5 text-sm" title="Gerar legenda">
              <FileText size={14} />
            </button>
            {/* Sequência: cada story tem seu próprio "Gravar este" acima — aqui o
                botão único só aparece para story/reels (conteúdo de gravação única). */}
            {!isMultiStory && (
              <button onClick={() => onRecord()} className="btn-secondary py-2.5 px-3.5 text-sm" title="Gravar">
                <Camera size={14} />
              </button>
            )}
            <button onClick={handleSave} className="btn-secondary py-2.5 px-3.5 text-sm"
              style={saved ? { borderColor: 'rgba(83,214,161,0.4)', color: '#53D6A1' } : {}}>
              <Bookmark size={14} style={saved ? { fill: '#53D6A1' } : {}} />
            </button>
          </div>
        </div>
      </div>

      {/* Variations */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest mb-2.5" style={{ color: 'var(--text-muted)' }}>
          Gerar variação
        </p>
        <div className="flex flex-wrap gap-2">
          {VARIATION_LABELS.map(v => (
            <button
              key={v.label}
              onClick={() => onVariation(v.label.toLowerCase())}
              className="chip chip-inactive text-xs"
            >
              <RefreshCw size={10} /> {v.icon} {v.label}
            </button>
          ))}
        </div>
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
        <div className="rounded-3xl p-5 text-center space-y-3"
          style={{ background: 'linear-gradient(135deg, rgba(109,93,246,0.12), rgba(155,140,255,0.06))', border: '1px solid rgba(109,93,246,0.2)' }}>
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto"
            style={{ background: 'linear-gradient(135deg, rgba(109,93,246,0.3), rgba(155,140,255,0.2))' }}>
            <Zap size={22} style={{ color: '#9B8CFF' }} />
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

  const paramType = searchParams.get('type') as 'story' | 'sequence' | 'reel' | null
  const paramTheme = searchParams.get('theme') ?? ''
  const paramObjective = searchParams.get('objective') ?? ''

  const [activeTab, setActiveTab] = useState<'criar' | 'livre' | 'roteiro' | 'ctas'>('criar')
  const [contentType, setContentType] = useState<'story' | 'sequence' | 'reel'>(paramType ?? 'story')
  const [theme, setTheme] = useState(paramTheme)
  const [objective, setObjective] = useState(paramObjective)
  const [format, setFormat] = useState('')
  const [timeAvailable, setTimeAvailable] = useState('5 minutos')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ContentIdea | null>(null)
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

  const profile = state.localProfile
  const themeOptions = [
    ...(profile?.pillars.map(p => p.name) ?? []),
    ...(profile?.services.map(s => s.name) ?? []),
    'Bastidor do dia', 'Dúvida frequente', 'Mito e verdade', 'Rotina de trabalho',
  ]

  const handleGenerate = async (variationHint?: string) => {
    if (!profile) return
    setLoading(true); setResult(null)
    try {
      const idea = await generateContent({
        type: contentType,
        theme: theme || (profile.pillars[0]?.name ?? profile.specialty ?? 'Conteúdo relevante'),
        objective: objective ? (variationHint ? `${objective} — ${variationHint}` : objective) : 'Conteúdo relevante e executável',
        format,
        exposureLevel: profile.exposureLevel,
        timeAvailable,
        tone: profile.voiceTone,
        profile,
      })
      setResult(idea); addIdea(idea)
      // Persiste automaticamente na biblioteca e sinaliza "salvo".
      const id = await persistIdeaToLibrary(idea)
      setLibraryItemId(id)
      if (id) { setSavedNotice(true); setTimeout(() => setSavedNotice(false), 2500) }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[Criar generateContent]', msg)
      setResult({ id: 'error', type: contentType, theme: 'Erro na geração', objective: '', content: `Falha ao gerar conteúdo:\n\n${msg}`, cta: '', timeEstimate: '', exposureLevel: profile?.exposureLevel ?? 'no-appearance', status: 'pending', favorite: false, createdAt: new Date().toISOString(), tags: [] })
    } finally { setLoading(false) }
  }

  const handleVariation = async (hint: string) => {
    if (!profile || !result) return
    setLoading(true)
    try {
      const idea = await generateContent({
        type: result.type, theme: result.theme,
        objective: `${result.objective} — ${hint}`,
        exposureLevel: profile.exposureLevel,
        timeAvailable: result.timeEstimate,
        tone: profile.voiceTone, profile,
      })
      setResult(idea); addIdea(idea)
      const id = await persistIdeaToLibrary(idea)
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
    if (!profile || !freeTopic.trim()) return
    setLoading(true); setResult(null)
    try {
      const idea = await generateFreeStory(profile, freeTopic.trim(), freeVibe)
      setResult(idea); addIdea(idea)
      const id = await persistIdeaToLibrary(idea)
      setLibraryItemId(id)
      if (id) { setSavedNotice(true); setTimeout(() => setSavedNotice(false), 2500) }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[Criar generateFree]', msg)
      setResult({ id: 'error', type: 'story', theme: 'Erro na geração', objective: '', content: `Falha ao gerar:\n\n${msg}`, cta: '', timeEstimate: '', exposureLevel: profile?.exposureLevel ?? 'no-appearance', status: 'pending', favorite: false, createdAt: new Date().toISOString(), tags: [] })
    } finally { setLoading(false) }
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
        <h1 className="text-3xl font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>Destravar</h1>
        <p className="text-sm mt-1 font-medium" style={{ color: 'var(--text-secondary)' }}>
          Escolha o formato, defina o tema e receba o roteiro.
        </p>
      </div>

      {/* Atalho para a Essência quando incompleta — roteiros ficam muito mais
          personalizados com ela preenchida. (Essência saiu da navbar.) */}
      {!profile?.pillars?.length && (
        <button onClick={() => navigate('/essencia')}
          className="w-full rounded-2xl p-4 flex items-center gap-3 text-left transition-all active:scale-[0.99]"
          style={{ background: 'linear-gradient(135deg, rgba(247,185,85,0.12), rgba(255,122,107,0.06))', border: '1px solid rgba(247,185,85,0.3)' }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(247,185,85,0.15)', border: '1px solid rgba(247,185,85,0.3)' }}>
            <Star size={17} style={{ color: '#F7B955' }} />
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
      <div className="flex gap-1 p-1 rounded-2xl overflow-x-auto scrollbar-hide" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
        {([
          { key: 'criar', label: 'Roteiro', Icon: Sparkles },
          { key: 'livre', label: 'Momento livre', Icon: Coffee },
          { key: 'roteiro', label: 'Meu roteiro', Icon: PenLine },
        ] as const).map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className="flex-1 min-w-[88px] py-2.5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all duration-200 whitespace-nowrap"
            style={activeTab === key ? {
              background: 'linear-gradient(135deg, #6D5DF6, #9B8CFF)',
              color: '#fff',
              boxShadow: '0 4px 16px rgba(109,93,246,0.4)',
            } : { color: 'var(--text-muted)' }}
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
        <div className="rounded-3xl p-5 space-y-1"
          style={{ background: 'linear-gradient(135deg, rgba(247,185,85,0.1), rgba(255,122,107,0.06))', border: '1px solid rgba(247,185,85,0.25)' }}>
          <p className="font-extrabold text-base flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <Coffee size={16} style={{ color: '#F7B955' }} /> Fala o que está na sua cabeça
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
        <div className="rounded-3xl p-5 space-y-1"
          style={{ background: 'linear-gradient(135deg, rgba(83,214,161,0.1), rgba(109,93,246,0.06))', border: '1px solid rgba(83,214,161,0.25)' }}>
          <p className="font-extrabold text-base flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <PenLine size={16} style={{ color: '#53D6A1' }} /> Já tenho o que falar
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
              onClick={() => { setContentType(value); setFormat(''); setResult(null) }}
              className="rounded-2xl p-3.5 text-center transition-all duration-300 active:scale-95"
              style={contentType === value ? {
                background: 'linear-gradient(135deg, rgba(109,93,246,0.25), rgba(155,140,255,0.15))',
                border: '1px solid rgba(109,93,246,0.4)',
                boxShadow: '0 0 20px rgba(109,93,246,0.2)',
              } : {
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
              }}
            >
              <div className="flex justify-center mb-2">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={contentType === value
                    ? { background: 'rgba(124,92,255,0.2)', border: '1px solid rgba(124,92,255,0.3)' }
                    : { background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-color)' }}>
                  <Icon size={18} style={{ color: contentType === value ? '#9B8CFF' : 'var(--text-muted)' }} />
                </div>
              </div>
              <span className="block text-sm font-extrabold" style={{ color: contentType === value ? '#9B8CFF' : 'var(--text-primary)' }}>{label}</span>
              <span className="block text-[10px] font-medium mt-0.5" style={{ color: 'var(--text-muted)' }}>{desc}</span>
            </button>
          ))}
        </div>

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
          <DarkSelect
            label={contentType !== 'reel' ? 'Formato' : 'Estilo do reels'}
            options={contentType !== 'reel' ? FORMATS_STORY : FORMATS_REEL}
            value={format} onChange={setFormat} placeholder="Qualquer formato"
          />
          <DarkSelect label="Tempo disponível" options={TIME_OPTIONS} value={timeAvailable} onChange={setTimeAvailable} />
        </div>

        {/* Generate button */}
        <button
          onClick={() => handleGenerate()}
          disabled={loading || !profile}
          className="btn-primary w-full py-4 text-base disabled:opacity-40"
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

        {result && !loading && (
          <ResultCard
            idea={result}
            onVariation={handleVariation}
            onSave={() => {
              updateIdea(result.id, { favorite: true })
              if (libraryItemId) updateLibraryItem(libraryItemId, { is_favorite: true }).catch(() => {})
            }}
            onCopy={() => {}}
            onRecord={(override) => { setStudioIdea(override ?? result); setShowStudio(true) }}
            onCaption={handleCaption}
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
