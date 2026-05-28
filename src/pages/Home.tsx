import { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { useToast } from '../context/ToastContext'
import { useNavigate } from 'react-router-dom'
import { Clock, Flame, ChevronRight, Check, Bookmark, RefreshCw, Sparkles, ArrowRight, Settings, Camera, Wand2, FileText, Copy, X } from 'lucide-react'
import type { ContentIdea } from '../types'
import { generateContent, generateCheckinIdea, generateCaption } from '../lib/ai'
import { getQuoteOfDay } from '../lib/quotes'
import { todayKey } from '../lib/progress'
import StudioModal from '../components/StudioModal'

// Check-ins universais fixos
const BASE_CHECKIN_OPTIONS = [
  { label: 'Tenho 2 min', value: '2min', icon: '⚡' },
  { label: 'Tenho 10 min', value: '10min', icon: '⏰' },
  { label: 'Quero vender', value: 'sell', icon: '💰' },
  { label: 'Quero educar', value: 'educate', icon: '📚' },
  { label: 'Algo leve', value: 'light', icon: '☀️' },
  { label: 'Gravar reels', value: 'reel', icon: '🎬' },
]

// Mapeamento de momentos do perfil para check-in keys
const MOMENT_TO_CHECKIN: Record<string, { value: string; icon: string }> = {
  'No trabalho': { value: 'work', icon: '💼' },
  'No consultório': { value: 'work', icon: '🏥' },
  'Em casa': { value: 'home', icon: '🏠' },
  'No carro': { value: '2min', icon: '🚗' },
  'Intervalo': { value: '10min', icon: '☕' },
  'Antes do trabalho': { value: '2min', icon: '🌅' },
  'Antes do atendimento': { value: '2min', icon: '🌅' },
  'Fim do dia': { value: 'light', icon: '🌙' },
  'De manhã cedo': { value: '2min', icon: '🌅' },
  'À noite': { value: 'light', icon: '🌙' },
}

const VARIATION_OPTIONS = [
  { label: 'Mais fácil', hint: 'mais simples e rápido de executar' },
  { label: 'Mais vendedor', hint: 'com foco em venda e CTA direto' },
  { label: 'Com humor', hint: 'com leveza e humor natural' },
  { label: 'Sem aparecer', hint: 'sem precisar aparecer no vídeo' },
]

const CHECKIN_STORAGE_KEY = `destravai-checkin-${todayKey()}`
const DAILY_MISSION_KEY = `destravai-daily-${todayKey()}`

// Modal de legenda gerada
function CaptionModal({ caption, hashtags, onClose }: { caption: string; hashtags: string[]; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const fullText = caption + '\n\n' + hashtags.join(' ')

  const handleCopy = () => {
    navigator.clipboard.writeText(fullText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-[150] flex flex-col justify-end" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
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

function IdeaCard({ idea, onDone, onSave, onVariation, onRecord, onCaption, featured }: {
  idea: ContentIdea
  onDone: () => void
  onSave: () => void
  onVariation: (hint: string) => void
  onRecord: () => void
  onCaption: () => void
  featured?: boolean
}) {
  const [expanded, setExpanded] = useState(featured ?? false)
  const [showVariations, setShowVariations] = useState(false)

  const TYPE_META: Record<string, { icon: string; label: string }> = {
    story: { icon: '📱', label: 'Story' },
    sequence: { icon: '🎞️', label: 'Sequência' },
    reel: { icon: '🎬', label: 'Reels' },
  }
  const meta = TYPE_META[idea.type] ?? { icon: '📝', label: idea.type }

  return (
    <div
      className="relative overflow-hidden rounded-3xl transition-all duration-300"
      style={featured ? {
        background: 'linear-gradient(135deg, rgba(109,93,246,0.15) 0%, rgba(155,140,255,0.08) 100%)',
        border: '1px solid rgba(109,93,246,0.3)',
        boxShadow: '0 0 32px rgba(109,93,246,0.12), 0 8px 32px rgba(0,0,0,0.4)',
      } : {
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
      }}
    >
      {featured && (
        <div className="absolute top-0 left-0 right-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(109,93,246,0.7), transparent)' }} />
      )}

      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1">
            <div className="flex flex-wrap gap-1.5 mb-2">
              <span className="tag tag-purple">{meta.icon} {meta.label}</span>
              <span className="tag tag-amber flex items-center gap-1"><Clock size={9} /> {idea.timeEstimate}</span>
              {idea.status === 'done' && <span className="tag tag-mint flex items-center gap-1"><Check size={9} /> Feito</span>}
              {idea.status === 'saved' && <span className="tag" style={{ background: 'rgba(109,93,246,0.15)', border: '1px solid rgba(109,93,246,0.3)', color: '#9B8CFF' }}>⭐ Salvo</span>}
            </div>
            <h3 className="font-extrabold text-base leading-snug" style={{ color: 'var(--text-primary)' }}>{idea.theme}</h3>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{idea.objective}</p>
          </div>
        </div>

        {expanded && (
          <div className="mt-4 space-y-3">
            <div className="rounded-2xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
              <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                {idea.content}
              </pre>
            </div>
            {idea.cta && (
              <div className="rounded-2xl p-3" style={{ background: 'rgba(255,122,107,0.08)', border: '1px solid rgba(255,122,107,0.2)' }}>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#FF7A6B' }}>CTA</p>
                <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{idea.cta}</p>
              </div>
            )}
          </div>
        )}

        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-sm font-bold mt-3 transition-colors"
          style={{ color: '#9B8CFF' }}
        >
          {expanded ? 'Fechar' : 'Ver completo'}
          <ChevronRight size={14} style={{ transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
        </button>

        {idea.status !== 'done' && (
          <div className="mt-4 pt-4 space-y-2" style={{ borderTop: '1px solid var(--border-color)' }}>
            <div className="flex gap-2">
              <button onClick={onDone} className="btn-primary flex-1 py-2.5 text-sm">
                <Check size={14} /> Fiz
              </button>
              <button onClick={onRecord} className="btn-secondary py-2.5 px-3.5 text-sm" title="Gravar">
                <Camera size={14} />
              </button>
              <button onClick={onCaption} className="btn-secondary py-2.5 px-3.5 text-sm" title="Gerar legenda">
                <FileText size={14} />
              </button>
              <button onClick={onSave} className="btn-secondary py-2.5 px-3.5 text-sm"
                style={idea.status === 'saved' ? { borderColor: 'rgba(109,93,246,0.4)', color: '#9B8CFF' } : {}}>
                <Bookmark size={14} />
              </button>
              <button onClick={() => setShowVariations(!showVariations)} className="btn-secondary py-2.5 px-3.5 text-sm">
                <RefreshCw size={14} />
              </button>
            </div>

            {showVariations && (
              <div className="flex flex-wrap gap-1.5 pt-1 animate-fade-up">
                {VARIATION_OPTIONS.map(v => (
                  <button
                    key={v.label}
                    onClick={() => { onVariation(v.hint); setShowVariations(false) }}
                    className="chip chip-inactive text-xs"
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

interface DayState {
  checkin: string
  mission: ContentIdea | null
  extras: ContentIdea[]
}

export default function Home() {
  const { state, addIdea, updateIdea, addMission, updateMission, completeMission } = useApp()
  const { addToast } = useToast()
  const navigate = useNavigate()

  const [dayState, setDayState] = useState<DayState>(() => {
    try {
      const stored = localStorage.getItem(CHECKIN_STORAGE_KEY)
      return stored ? JSON.parse(stored) : { checkin: '', mission: null, extras: [] }
    } catch {
      return { checkin: '', mission: null, extras: [] }
    }
  })

  const [loading, setLoading] = useState(false)
  const [studioIdea, setStudioIdea] = useState<ContentIdea | null>(null)
  const [captionIdea, setCaptionIdea] = useState<ContentIdea | null>(null)
  const [captionData, setCaptionData] = useState<{ caption: string; hashtags: string[] } | null>(null)
  const [captionLoading, setCaptionLoading] = useState(false)

  const profile = state.localProfile  // ProfessionalProfile para chamadas de IA
  const progress = state.progress
  const quote = getQuoteOfDay()
  const firstName = profile?.professionalName?.split(' ')[0]
    ?? state.profile?.name?.split(' ')[0]
    ?? state.supabaseUser?.user_metadata?.name?.split(' ')[0]
    ?? 'você'

  // Monta chips dinâmicos: base + momentos do perfil que ainda não estão na base
  const checkinOptions = (() => {
    const baseValues = new Set(BASE_CHECKIN_OPTIONS.map(o => o.value))
    const dynamicChips: typeof BASE_CHECKIN_OPTIONS = []

    if (profile?.availableMoments?.length) {
      profile.availableMoments.forEach(moment => {
        const mapped = MOMENT_TO_CHECKIN[moment]
        if (mapped && !baseValues.has(mapped.value) && !dynamicChips.find(c => c.value === mapped.value)) {
          dynamicChips.push({ label: moment, value: mapped.value, icon: mapped.icon })
          baseValues.add(mapped.value)
        } else if (mapped && !dynamicChips.find(c => c.label === moment)) {
          // Mesmo valor mas label diferente — adiciona como alias se ainda não existe label igual
          const alreadyExists = BASE_CHECKIN_OPTIONS.find(b => b.label === moment)
          if (!alreadyExists) {
            dynamicChips.push({ label: moment, value: mapped.value, icon: mapped.icon })
          }
        }
      })
    }

    // Se não tem "No trabalho" nem chip de escritório e o perfil existe, adiciona
    if (profile && !baseValues.has('work')) {
      dynamicChips.push({ label: 'No trabalho', value: 'work', icon: '💼' })
    }

    return [...BASE_CHECKIN_OPTIONS, ...dynamicChips.slice(0, 2)]
  })()

  useEffect(() => {
    if (dayState.checkin) {
      localStorage.setItem(CHECKIN_STORAGE_KEY, JSON.stringify(dayState))
    }
  }, [dayState])

  useEffect(() => {
    const alreadyGenerated = localStorage.getItem(DAILY_MISSION_KEY)
    if (!alreadyGenerated && profile && !dayState.checkin) {
      generateDailyMission()
    }
  }, [profile]) // eslint-disable-line react-hooks/exhaustive-deps

  const generateDailyMission = async () => {
    if (!profile) return
    const already = localStorage.getItem(DAILY_MISSION_KEY)
    if (already) return

    try {
      const pillar = profile.pillars[new Date().getDay() % Math.max(1, profile.pillars.length)]
      const idea = await generateContent({
        type: 'story',
        theme: pillar?.name ?? profile.specialty ?? 'Autoridade na área',
        objective: 'Missão do dia — conteúdo possível, simples e executável',
        exposureLevel: profile.exposureLevel,
        timeAvailable: '5 minutos',
        tone: profile.voiceTone,
        profile,
      })
      localStorage.setItem(DAILY_MISSION_KEY, 'generated')
      addIdea(idea)
      addMission({ id: crypto.randomUUID(), title: idea.theme, description: idea.objective, type: idea.type, status: 'pending', date: new Date().toISOString(), content: idea, points: 10 })
      addToast('Sua missão de hoje está pronta! 🎯', 'info')
    } catch {
      // silencioso
    }
  }

  const handleCheckin = async (value: string) => {
    if (!profile) return
    setLoading(true)

    try {
      const missionIdea = await generateCheckinIdea(profile, value)
      const e1 = await generateCheckinIdea(profile, 'educate')
      const e2 = await generateCheckinIdea(profile, 'sell')

      const extras = [e1, e2]
      const newDayState: DayState = { checkin: value, mission: missionIdea, extras }
      setDayState(newDayState)

      addMission({ id: crypto.randomUUID(), title: missionIdea.theme, description: missionIdea.objective, type: missionIdea.type, status: 'pending', date: new Date().toISOString(), content: missionIdea, points: 10 })
      addIdea(missionIdea)
      extras.forEach(i => addIdea(i))

      addToast('Ideias prontas para hoje! ✨', 'success')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[Home checkin]', msg)
      addToast(`Erro: ${msg.slice(0, 160)}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  // "Surpreenda-me" — gera usando pilar aleatório sem exigir check-in
  const handleSurprise = async () => {
    if (!profile) return
    setLoading(true)
    try {
      const formats = ['2min', 'reel', 'educate', 'light'] as const
      const randomKey = formats[Math.floor(Math.random() * formats.length)]
      const missionIdea = await generateCheckinIdea(profile, randomKey)
      const extras = await Promise.all([
        generateCheckinIdea(profile, 'educate'),
        generateCheckinIdea(profile, 'sell'),
      ])
      const newDayState: DayState = { checkin: randomKey, mission: missionIdea, extras }
      setDayState(newDayState)
      addMission({ id: crypto.randomUUID(), title: missionIdea.theme, description: missionIdea.objective, type: missionIdea.type, status: 'pending', date: new Date().toISOString(), content: missionIdea, points: 10 })
      addIdea(missionIdea)
      extras.forEach(i => addIdea(i))
      addToast('Surpresa gerada! ✨', 'success')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      addToast(`Erro: ${msg.slice(0, 160)}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleDone = (idea: ContentIdea) => {
    updateIdea(idea.id, { status: 'done' })
    const m = state.missions.find(m => m.content?.id === idea.id)
    if (m) updateMission(m.id, { status: 'done' })
    completeMission(idea.objective)

    if (dayState.mission?.id === idea.id) {
      setDayState(prev => ({ ...prev, mission: prev.mission ? { ...prev.mission, status: 'done' } : null }))
    } else {
      setDayState(prev => ({ ...prev, extras: prev.extras.map(i => i.id === idea.id ? { ...i, status: 'done' } : i) }))
    }

    addToast('Missão concluída! +10 pontos 🔥', 'success')
  }

  const handleSave = (idea: ContentIdea) => {
    updateIdea(idea.id, { favorite: true, status: 'saved' })
    if (dayState.mission?.id === idea.id) {
      setDayState(prev => ({ ...prev, mission: prev.mission ? { ...prev.mission, status: 'saved' } : null }))
    } else {
      setDayState(prev => ({ ...prev, extras: prev.extras.map(i => i.id === idea.id ? { ...i, status: 'saved' } : i) }))
    }
    addToast('Ideia salva na biblioteca!', 'info')
  }

  const handleVariation = async (idea: ContentIdea, hint: string) => {
    if (!profile) return
    setLoading(true)
    try {
      const checkinKey = dayState.checkin || '2min'
      const variation = await generateCheckinIdea(profile, checkinKey, hint)
      addIdea(variation)
      if (dayState.mission?.id === idea.id) {
        setDayState(prev => ({ ...prev, mission: variation }))
      } else {
        setDayState(prev => ({ ...prev, extras: prev.extras.map(i => i.id === idea.id ? variation : i) }))
      }
      addToast('Variação gerada! ✨', 'info')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      addToast(`Erro na variação: ${msg.slice(0, 120)}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleCaption = async (idea: ContentIdea) => {
    if (!profile) return
    setCaptionIdea(idea)
    setCaptionLoading(true)
    setCaptionData(null)
    try {
      const data = await generateCaption(idea, profile)
      setCaptionData(data)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      addToast(`Erro na legenda: ${msg.slice(0, 120)}`, 'error')
      setCaptionIdea(null)
    } finally {
      setCaptionLoading(false)
    }
  }

  const dayOfWeek = new Date().toLocaleDateString('pt-BR', { weekday: 'long' })
  const dayNum = new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })
  const { checkin, mission, extras } = dayState

  return (
    <div className="p-5 space-y-5 pb-8">
      {/* Header */}
      <div className="pt-4 flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>
            {dayOfWeek} · {dayNum}
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight leading-tight">
            <span style={{ color: 'var(--text-primary)' }}>Olá, </span>
            <span className="gradient-text">{firstName}</span>
          </h1>

          <div className="mt-3 pl-3 py-1" style={{ borderLeft: '2px solid rgba(109,93,246,0.4)' }}>
            <p className="text-sm italic leading-snug" style={{ color: 'var(--text-secondary)' }}>
              "{quote.text}"
            </p>
            <p className="text-[10px] font-bold uppercase tracking-widest mt-1" style={{ color: 'var(--text-muted)' }}>
              — {quote.author}
            </p>
          </div>
        </div>
        <button onClick={() => navigate('/configuracoes')} className="ml-3 w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
          <Settings size={16} style={{ color: 'var(--text-muted)' }} />
        </button>
      </div>

      {/* Stats strip */}
      <div className="rounded-2xl p-4 flex items-center gap-4"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(255,122,107,0.15)', border: '1px solid rgba(255,122,107,0.25)' }}>
            <Flame size={15} style={{ color: '#FF7A6B' }} />
          </div>
          <div>
            <p className="text-lg font-extrabold leading-none" style={{ color: 'var(--text-primary)' }}>{progress.currentStreak}</p>
            <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>dias</p>
          </div>
        </div>
        <div className="h-8 w-px" style={{ background: 'var(--bg-card-bright)' }} />
        <div>
          <p className="text-lg font-extrabold leading-none" style={{ color: 'var(--text-primary)' }}>{progress.weeklyMissions}</p>
          <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>semana</p>
        </div>
        <div className="h-8 w-px" style={{ background: 'var(--bg-card-bright)' }} />
        <span className="text-[10px] font-bold px-2 py-1 rounded-full"
          style={{ background: 'rgba(109,93,246,0.15)', border: '1px solid rgba(109,93,246,0.25)', color: '#9B8CFF' }}>
          {progress.level}
        </span>
      </div>

      {/* Check-in / conteúdo */}
      {!checkin ? (
        <div className="space-y-3">
          <p className="section-title">Como está seu dia?</p>
          <div className="grid grid-cols-2 gap-2">
            {checkinOptions.map(opt => (
              <button key={opt.value + opt.label} onClick={() => handleCheckin(opt.value)}
                className="text-left p-4 rounded-2xl transition-all duration-200 active:scale-95"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(109,93,246,0.1)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(109,93,246,0.3)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-card)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-color)' }}
              >
                <span className="text-xl block mb-1.5">{opt.icon}</span>
                <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{opt.label}</span>
              </button>
            ))}
          </div>

          {/* Surpreenda-me */}
          {profile && (
            <button
              onClick={handleSurprise}
              className="w-full py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
              style={{
                background: 'linear-gradient(135deg, rgba(109,93,246,0.15), rgba(155,140,255,0.08))',
                border: '1px solid rgba(109,93,246,0.3)',
                color: '#9B8CFF',
              }}
            >
              <Wand2 size={15} /> Surpreenda-me — gera uma ideia agora
            </button>
          )}
        </div>
      ) : loading ? (
        <div className="rounded-3xl p-8 flex flex-col items-center justify-center gap-4 text-center"
          style={{ background: 'rgba(109,93,246,0.08)', border: '1px solid rgba(109,93,246,0.2)' }}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, rgba(109,93,246,0.3), rgba(155,140,255,0.2))', border: '1px solid rgba(109,93,246,0.3)' }}>
            <Sparkles size={24} style={{ color: '#9B8CFF' }} className="animate-pulse" />
          </div>
          <div>
            <p className="font-extrabold text-lg" style={{ color: 'var(--text-primary)' }}>Criando suas ideias...</p>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Personalizando para o seu perfil</p>
          </div>
          <div className="flex gap-1.5">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ background: '#9B8CFF', animationDelay: `${i * 0.25}s` }} />
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {mission && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, #FF7A6B, #F7B955)', boxShadow: '0 0 12px rgba(255,122,107,0.3)' }}>
                  <Flame size={12} className="text-white" />
                </div>
                <p className="section-title">Missão de hoje</p>
              </div>
              <IdeaCard idea={mission} onDone={() => handleDone(mission)} onSave={() => handleSave(mission)}
                onVariation={(hint) => handleVariation(mission, hint)}
                onRecord={() => setStudioIdea(mission)}
                onCaption={() => handleCaption(mission)}
                featured />
            </div>
          )}

          {extras.length > 0 && (
            <div>
              <p className="section-title mb-3">Mais ideias para hoje</p>
              <div className="space-y-3">
                {extras.map(idea => (
                  <IdeaCard key={idea.id} idea={idea}
                    onDone={() => handleDone(idea)}
                    onSave={() => handleSave(idea)}
                    onVariation={(hint) => handleVariation(idea, hint)}
                    onRecord={() => setStudioIdea(idea)}
                    onCaption={() => handleCaption(idea)} />
                ))}
              </div>
            </div>
          )}

          <button onClick={() => navigate('/criar')} className="btn-secondary w-full">
            <Sparkles size={16} /> Criar mais ideias <ArrowRight size={16} />
          </button>

          <button
            onClick={() => {
              localStorage.removeItem(CHECKIN_STORAGE_KEY)
              localStorage.removeItem(DAILY_MISSION_KEY)
              setDayState({ checkin: '', mission: null, extras: [] })
            }}
            className="w-full text-center text-xs py-2"
            style={{ color: 'var(--text-muted)' }}
          >
            Reiniciar missão do dia
          </button>
        </div>
      )}

      {/* CTA essência vazia */}
      {!checkin && !(profile?.pillars.length) && (
        <div className="relative rounded-3xl p-5 overflow-hidden"
          style={{ background: 'linear-gradient(135deg, rgba(109,93,246,0.2), rgba(155,140,255,0.1))', border: '1px solid rgba(109,93,246,0.3)' }}>
          <p className="font-extrabold text-lg mb-1" style={{ color: 'var(--text-primary)' }}>Complete sua essência</p>
          <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>Quanto mais você preenche, mais personalizadas ficam as ideias.</p>
          <button onClick={() => navigate('/essencia')} className="btn-primary text-sm py-2.5 px-4">
            Ver Minha Essência <ChevronRight size={14} />
          </button>
        </div>
      )}

      {studioIdea && (
        <StudioModal idea={studioIdea} onClose={() => setStudioIdea(null)} />
      )}

      {/* Modal de legenda */}
      {captionIdea && (
        captionLoading ? (
          <div className="fixed inset-0 z-[150] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}>
            <div className="flex flex-col items-center gap-3">
              <Sparkles size={28} style={{ color: '#9B8CFF' }} className="animate-pulse" />
              <p className="text-white font-bold text-sm">Gerando legenda...</p>
            </div>
          </div>
        ) : captionData ? (
          <CaptionModal caption={captionData.caption} hashtags={captionData.hashtags} onClose={() => { setCaptionIdea(null); setCaptionData(null) }} />
        ) : null
      )}
    </div>
  )
}
