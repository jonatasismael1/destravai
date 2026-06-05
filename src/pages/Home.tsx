import { useState, useEffect, useRef } from 'react'
import { useApp } from '../context/AppContext'
import { useToast } from '../context/ToastContext'
import { useNavigate } from 'react-router-dom'
import {
  Clock, Flame, ChevronRight, Check, Bookmark, RefreshCw, Sparkles, ArrowRight,
  Camera, Wand2, FileText, Copy, X,
  Zap, Timer, ShoppingBag, BookOpen, Sun, Film, Briefcase, TrendingUp, CalendarDays
} from 'lucide-react'
import type { ContentIdea } from '../types'
import type { LibraryItemType } from '../lib/supabase/types'
import { generateCheckinIdea, generateCaption } from '../lib/ai'
import { createLibraryItem } from '../services/libraryService'
import { splitSequenceStories, stripStoryHeader } from '../lib/stories'

// Persiste uma ideia da Home na biblioteca do Supabase (o botão "salvar" antes só
// mudava o estado local e mostrava o toast, sem criar o item de verdade).
function ideaToLibraryType(type: ContentIdea['type']): LibraryItemType {
  if (type === 'reel') return 'reels_script'
  if (type === 'sequence') return 'story_sequence'
  return 'content_idea'
}

async function persistIdeaToLibrary(idea: ContentIdea): Promise<boolean> {
  try {
    await createLibraryItem({
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
    return true
  } catch {
    return false
  }
}
import { useScreenTour } from '../context/OnboardingContext'
import { getQuoteOfDay } from '../lib/quotes'
import { deleteDailyCheckin, toISODateKey } from '../services/userJourneyService'
import { trackEvent, loadActivationStatus } from '../services/eventsService'
import { runActivationNudges } from '../services/notificationsService'
import StudioModal from '../components/StudioModal'
import GroupsOverview from '../components/GroupsOverview'
import { HeaderActions, TopTabs } from '../components/premium'

// Check-ins com ícones vetoriais (sem emojis estruturais)
const BASE_CHECKIN_OPTIONS = [
  { label: 'Tenho 2 min', value: '2min', Icon: Zap },
  { label: 'Tenho 10 min', value: '10min', Icon: Timer },
  { label: 'Quero vender', value: 'sell', Icon: ShoppingBag },
  { label: 'Quero educar', value: 'educate', Icon: BookOpen },
  { label: 'Algo leve', value: 'light', Icon: Sun },
  { label: 'Gravar reels', value: 'reel', Icon: Film },
]

const MOMENT_TO_CHECKIN: Record<string, { value: string; Icon: typeof Zap }> = {
  'No trabalho': { value: 'work', Icon: Briefcase },
  'No consultório': { value: 'work', Icon: Briefcase },
  'Em casa': { value: 'home', Icon: Sun },
  'No carro': { value: '2min', Icon: Zap },
  'Intervalo': { value: '10min', Icon: Timer },
  'Antes do trabalho': { value: '2min', Icon: Zap },
  'Antes do atendimento': { value: '2min', Icon: Zap },
  'Fim do dia': { value: 'light', Icon: Sun },
  'De manhã cedo': { value: '2min', Icon: Zap },
  'À noite': { value: 'light', Icon: Sun },
}

const VARIATION_OPTIONS = [
  { label: 'Mais fácil', hint: 'mais simples e rápido de executar' },
  { label: 'Mais vendedor', hint: 'com foco em venda e CTA direto' },
  { label: 'Com humor', hint: 'com leveza e humor natural' },
  { label: 'Sem aparecer', hint: 'sem precisar aparecer no vídeo' },
]

// Mapeamento de nível → missões necessárias para o próximo
// Nomes espelham calculateLevel() em src/lib/progress.ts
const LEVEL_MAP: Record<string, { next: string; missionTarget: number; missionFrom: number }> = {
  'Começando a aparecer': { next: 'Criando ritmo', missionTarget: 5, missionFrom: 0 },
  'Criando ritmo':        { next: 'Presença consistente', missionTarget: 15, missionFrom: 5 },
  'Presença consistente': { next: 'Perfil ativo', missionTarget: 30, missionFrom: 15 },
  'Perfil ativo':         { next: 'Referência em movimento', missionTarget: 50, missionFrom: 30 },
  'Referência em movimento': { next: '—', missionTarget: 999, missionFrom: 50 },
}

const TODAY_KEY = toISODateKey()

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
          <p className="font-extrabold text-base" style={{ color: 'var(--text-primary)' }}>Legenda gerada</p>
          <button onClick={onClose} style={{ color: 'var(--text-muted)' }} aria-label="Fechar"><X size={18} /></button>
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
  onRecord: (override?: ContentIdea) => void
  onCaption: () => void
  featured?: boolean
}) {
  const [expanded, setExpanded] = useState(featured ?? false)
  const [showVariations, setShowVariations] = useState(false)
  const [celebrating, setCelebrating] = useState(false)

  const TYPE_META: Record<string, { label: string }> = {
    story: { label: 'Story' },
    sequence: { label: 'Sequência' },
    reel: { label: 'Reels' },
  }
  const meta = TYPE_META[idea.type] ?? { label: idea.type }

  // Sequência → stories individuais, para ler e gravar 1 a 1.
  const stories = idea.type === 'sequence' ? splitSequenceStories(idea.content) : []
  const isMultiStory = stories.length > 1

  const handleDone = () => {
    setCelebrating(true)
    setTimeout(() => setCelebrating(false), 1200)
    onDone()
  }

  return (
    <div
      className="relative overflow-hidden rounded-2xl transition-all duration-300"
      style={featured ? {
        background: 'var(--bg-elevated)',
        border: '1px solid var(--brand-border)',
        boxShadow: 'var(--shadow-card)',
      } : {
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-subtle)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      {/* Faixa de marca no topo do card em destaque */}
      {featured && (
        <div className="absolute top-0 left-0 right-0 h-1" style={{ background: 'var(--brand)' }} />
      )}

      {/* Animação de celebração ao marcar Fiz */}
      {celebrating && (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none"
          style={{ background: 'rgba(83,214,161,0.08)' }}>
          <div className="flex flex-col items-center gap-2 animate-fade-up">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #53D6A1, #3BB88A)', boxShadow: '0 0 30px rgba(83,214,161,0.5)' }}>
              <Check size={28} className="text-white" />
            </div>
            <p className="text-sm font-extrabold" style={{ color: '#53D6A1' }}>+10 pontos!</p>
          </div>
        </div>
      )}

      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1">
            <div className="flex flex-wrap gap-1.5 mb-2">
              <span className="tag tag-purple">{meta.label}</span>
              <span className="tag tag-amber flex items-center gap-1"><Clock size={9} /> {idea.timeEstimate}</span>
              {idea.status === 'done' && <span className="tag tag-mint flex items-center gap-1"><Check size={9} /> Feito</span>}
              {idea.status === 'saved' && <span className="tag" style={{ background: 'rgba(109,93,246,0.15)', border: '1px solid rgba(109,93,246,0.3)', color: '#9B8CFF' }}>Salvo</span>}
            </div>
            <h3 className="font-extrabold text-base leading-snug" style={{ color: 'var(--text-primary)' }}>{idea.theme}</h3>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{idea.objective}</p>
          </div>
        </div>

        {expanded && (
          <div className="mt-4 space-y-3">
            {isMultiStory ? (
              <>
                <p className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                  Esta é uma sequência de {stories.length} stories. Grave um de cada vez:
                </p>
                {stories.map((story, i) => {
                  const body = stripStoryHeader(story)
                  // Ideia derivada SÓ deste story — vai para o gravador/teleprompter.
                  const storyIdea: ContentIdea = {
                    ...idea,
                    id: `${idea.id}-s${i + 1}`,
                    type: 'story',
                    theme: `Story ${i + 1} — ${idea.theme}`,
                    content: body,
                  }
                  return (
                    <div key={i} className="rounded-2xl p-4"
                      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="tag tag-purple text-[10px]">Story {i + 1} de {stories.length}</span>
                        {idea.status !== 'done' && (
                          <button onClick={() => onRecord(storyIdea)}
                            className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full"
                            style={{ background: 'linear-gradient(135deg, #6D5DF6, #9B8CFF)', color: '#fff' }}>
                            <Camera size={12} /> Gravar este
                          </button>
                        )}
                      </div>
                      <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                        {body}
                      </pre>
                    </div>
                  )
                })}
              </>
            ) : (
              <div className="rounded-2xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                  {idea.content}
                </pre>
              </div>
            )}
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
          {expanded ? 'Fechar roteiro' : 'Ver roteiro completo'}
          <ChevronRight size={14} style={{ transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
        </button>

        {idea.status !== 'done' && (
          <div className="mt-4 pt-4 space-y-2" style={{ borderTop: '1px solid var(--border-color)' }}>
            <div className="flex gap-2">
              {/* Botão Fiz — ação principal com label */}
              <button onClick={handleDone} className="btn-primary flex-1 py-2.5 text-sm gap-1.5">
                <Check size={14} /> Fiz
              </button>
              {/* Gravar — para sequência, abre o roteiro para escolher o story.
                  IMPORTANTE: usar () => onRecord() (sem passar o evento de clique,
                  que o onRecord agora interpretaria como ideia derivada). */}
              <button
                onClick={() => (isMultiStory ? setExpanded(true) : onRecord())}
                className="btn-secondary py-2.5 px-3.5 text-sm flex items-center gap-1.5"
                aria-label="Gravar com teleprompter"
                title={isMultiStory ? 'Escolha um story para gravar' : 'Gravar'}
              >
                <Camera size={14} />
                <span className="text-xs hidden sm:inline">{isMultiStory ? 'Gravar 1 a 1' : 'Gravar'}</span>
              </button>
              <button
                onClick={onCaption}
                className="btn-secondary py-2.5 px-3.5 text-sm flex items-center gap-1.5"
                aria-label="Gerar legenda"
                title="Legenda"
              >
                <FileText size={14} />
                <span className="text-xs hidden sm:inline">Legenda</span>
              </button>
              <button
                onClick={onSave}
                className="btn-secondary py-2.5 px-3.5 text-sm"
                aria-label="Salvar ideia"
                title="Salvar"
                style={idea.status === 'saved' ? { borderColor: 'rgba(109,93,246,0.4)', color: '#9B8CFF' } : {}}
              >
                <Bookmark size={14} />
              </button>
              <button
                onClick={() => setShowVariations(!showVariations)}
                className="btn-secondary py-2.5 px-3.5 text-sm"
                aria-label="Gerar variação"
                title="Variar"
              >
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

export default function Home() {
  const {
    state, addIdea, updateIdea, updateMission, completeMission,
    generateTodayContent, setTodayContent, resetTodayContent,
  } = useApp()
  const { addToast } = useToast()
  const navigate = useNavigate()

  // Tour de boas-vindas (apresenta o app) — dispara uma vez, após a essência.
  useScreenTour('main')

  // Conteúdo do dia e flag de geração vêm do AppContext: assim sobrevivem à
  // navegação entre telas (a missão continua sendo gerada em segundo plano).
  const dayState = state.todayContent
  const loading = state.generatingContent

  // Loading local só para ações pontuais na tela (variação/legenda) — essas estão
  // atreladas a um card visível e não precisam persistir entre telas.
  const [actionLoading, setActionLoading] = useState(false)
  const busy = loading || actionLoading
  const [studioIdea, setStudioIdea] = useState<ContentIdea | null>(null)
  // Guard de idempotência: impede que o mesmo conteúdo incremente o streak duas vezes
  // (ex: clique duplo ou re-render antes do estado atualizar).
  const doneIdeaIds = useRef(new Set<string>())
  const [captionIdea, setCaptionIdea] = useState<ContentIdea | null>(null)
  const [captionData, setCaptionData] = useState<{ caption: string; hashtags: string[] } | null>(null)
  const [captionLoading, setCaptionLoading] = useState(false)
  const [homeTab, setHomeTab] = useState<'hoje' | 'grupos'>('hoje')

  const profile = state.localProfile
  const progress = state.progress
  const headerInitials = (state.profile?.name ?? profile?.professionalName ?? 'DB')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
    .join('')
    .toUpperCase() || 'DB'
  const firstName = profile?.professionalName?.split(' ')[0]
    ?? state.profile?.name?.split(' ')[0]
    ?? state.supabaseUser?.user_metadata?.name?.split(' ')[0]
    ?? 'você'

  // Progresso para o próximo nível (baseado em missionsCompleted)
  const levelInfo = LEVEL_MAP[progress.level] ?? LEVEL_MAP['Começando a aparecer']
  const missionsInLevel = progress.missionsCompleted - levelInfo.missionFrom
  const missionsNeeded = levelInfo.missionTarget - levelInfo.missionFrom
  const levelProgress = Math.min(100, Math.round((missionsInLevel / missionsNeeded) * 100))

  // Chips de check-in com ícones vetoriais
  const checkinOptions = (() => {
    const baseValues = new Set(BASE_CHECKIN_OPTIONS.map(o => o.value))
    const dynamicChips: typeof BASE_CHECKIN_OPTIONS = []

    if (profile?.availableMoments?.length) {
      profile.availableMoments.forEach(moment => {
        const mapped = MOMENT_TO_CHECKIN[moment]
        if (mapped && !baseValues.has(mapped.value) && !dynamicChips.find(c => c.value === mapped.value)) {
          dynamicChips.push({ label: moment, value: mapped.value, Icon: mapped.Icon })
          baseValues.add(mapped.value)
        } else if (mapped && !dynamicChips.find(c => c.label === moment)) {
          const alreadyExists = BASE_CHECKIN_OPTIONS.find(b => b.label === moment)
          if (!alreadyExists) {
            dynamicChips.push({ label: moment, value: mapped.value, Icon: mapped.Icon })
          }
        }
      })
    }

    if (profile && !baseValues.has('work')) {
      dynamicChips.push({ label: 'No trabalho', value: 'work', Icon: Briefcase })
    }

    return [...BASE_CHECKIN_OPTIONS, ...dynamicChips.slice(0, 2)]
  })()

  // O carregamento do conteúdo do dia agora vive no AppContext (persiste entre
  // telas). A Home apenas consome state.todayContent / state.generatingContent.

  // Registra o retorno do usuário e dispara os nudges de notificação (D1/D3/D7).
  useEffect(() => {
    if (!state.supabaseUser) return
    void trackEvent('returned')
    loadActivationStatus().then((a) => {
      void runActivationNudges({ hasPendingMission: true, activeDays: a?.activeDays ?? 0 })
    })
  }, [state.supabaseUser?.id])

  // A geração roda no AppContext (persiste entre telas). Aqui só disparamos e
  // tratamos o toast — se o usuário sair da Home, a missão continua sendo gerada
  // e aparece pronta quando ele volta.
  const handleCheckin = async (value: string) => {
    if (!profile || loading) return
    try {
      await generateTodayContent(profile, value)
      addToast('Ideias prontas para hoje!', 'success')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[Home checkin]', msg)
      addToast(`Erro: ${msg.slice(0, 160)}`, 'error')
    }
  }

  const handleSurprise = async () => {
    if (!profile || loading) return
    const formats = ['2min', 'reel', 'educate', 'light'] as const
    const randomKey = formats[Math.floor(Math.random() * formats.length)]
    try {
      await generateTodayContent(profile, randomKey)
      addToast('Surpresa gerada!', 'success')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      addToast(`Erro: ${msg.slice(0, 160)}`, 'error')
    }
  }

  const handleDone = (idea: ContentIdea) => {
    // Impede double-counting: ignora se a ideia já foi marcada como feita nesta sessão
    // ou se o estado já reflete 'done' (proteção contra cliques rápidos e re-renders).
    if (idea.status === 'done' || doneIdeaIds.current.has(idea.id)) return
    doneIdeaIds.current.add(idea.id)

    updateIdea(idea.id, { status: 'done' })
    const m = state.missions.find(m => m.content?.id === idea.id)
    if (m) updateMission(m.id, { status: 'done' })
    completeMission(idea.objective)
    // Registra o evento de execução — alimenta o ranking dos grupos (XP de missão).
    void trackEvent('mission_done', idea.id)

    // setTodayContent persiste no Supabase e mantém o estado vivo entre telas.
    setTodayContent(prev =>
      prev.mission?.id === idea.id
        ? { ...prev, mission: prev.mission ? { ...prev.mission, status: 'done' as const } : null }
        : { ...prev, extras: prev.extras.map(i => i.id === idea.id ? { ...i, status: 'done' as const } : i) }
    )

    addToast('Missão concluída! +10 pontos', 'success')
  }

  const handleSave = (idea: ContentIdea) => {
    // Evita salvar duas vezes a mesma ideia já marcada como salva.
    const alreadySaved =
      (dayState.mission?.id === idea.id && dayState.mission?.status === 'saved') ||
      dayState.extras.some(i => i.id === idea.id && i.status === 'saved')

    updateIdea(idea.id, { favorite: true, status: 'saved' })
    setTodayContent(prev =>
      prev.mission?.id === idea.id
        ? { ...prev, mission: prev.mission ? { ...prev.mission, status: 'saved' as const } : null }
        : { ...prev, extras: prev.extras.map(i => i.id === idea.id ? { ...i, status: 'saved' as const } : i) }
    )

    if (alreadySaved) {
      addToast('Essa ideia já está na sua Biblioteca (em Espaço).', 'info')
      return
    }
    // Cria o item na biblioteca de verdade e só confirma se gravou.
    void persistIdeaToLibrary(idea).then(ok => {
      addToast(
        ok ? 'Ideia salva na Biblioteca (em Espaço)!' : 'Não consegui salvar na biblioteca. Tente de novo.',
        ok ? 'success' : 'error',
      )
    })
  }

  const handleVariation = async (idea: ContentIdea, hint: string) => {
    if (!profile || busy) return
    setActionLoading(true)
    try {
      const checkinKey = dayState.checkin || '2min'
      const variation = await generateCheckinIdea(profile, checkinKey, hint)
      addIdea(variation)
      // Forma funcional evita estado defasado após o await.
      setTodayContent(prev =>
        prev.mission?.id === idea.id
          ? { ...prev, mission: variation }
          : { ...prev, extras: prev.extras.map(i => i.id === idea.id ? variation : i) }
      )
      addToast('Variação gerada!', 'info')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      addToast(`Erro na variação: ${msg.slice(0, 120)}`, 'error')
    } finally {
      setActionLoading(false)
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
  const quote = getQuoteOfDay() // frase do dia (muda automaticamente a cada dia)
  const quoteFontSize = quote.text.length > 120 ? 18 : quote.text.length > 92 ? 20 : quote.text.length > 68 ? 22 : 24
  const { checkin, mission, extras } = dayState

  return (
    <div className="p-5 space-y-5 pb-8">
      <div className="pt-4 flex items-start justify-between gap-4">
        <div data-tour="home-grupos">
          <TopTabs
            items={[
              { value: 'hoje', label: 'Hoje' },
              { value: 'grupos', label: 'Grupos' },
            ]}
            value={homeTab}
            onChange={setHomeTab}
          />
        </div>
        <HeaderActions initials={headerInitials} avatarUrl={state.profile?.avatar_url} showNotifications={false} />
      </div>

      {homeTab === 'grupos' ? (
        <GroupsOverview />
      ) : (
      <>
      {/* ── Header ─────────────────────────────────── */}
      {/* Configurações agora vivem na navbar (acesso global), então a engrenagem
          do topo foi removida para não duplicar o mesmo atalho na própria Home. */}
      <div className="pt-4">
        <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>
          {dayOfWeek} · {dayNum}
        </p>
        <h1 className="text-3xl font-extrabold tracking-tight leading-tight">
          <span style={{ color: 'var(--text-primary)' }}>Olá, </span>
          <span className="gradient-text">{firstName}</span>
        </h1>
        <p className="text-sm mt-1 font-medium" style={{ color: 'var(--text-secondary)' }}>
          O que você quer postar hoje?
        </p>
      </div>

      {/* ── Frase motivacional do dia ──────────────── */}
      <div className="relative rounded-[26px] p-6 min-h-[190px] overflow-hidden app-card"
        style={{
          backgroundImage: "url('/fundo-frase.png')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          boxShadow: '0 24px 60px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.08)',
        }}>
        <div className="absolute inset-0"
          style={{
            background:
              'linear-gradient(90deg, rgba(3,3,7,0.92) 0%, rgba(6,5,12,0.76) 42%, rgba(6,5,12,0.28) 100%), linear-gradient(180deg, rgba(0,0,0,0.12), rgba(0,0,0,0.32))',
          }}
        />
        <div className="absolute inset-x-0 bottom-0 h-20" style={{ background: 'linear-gradient(0deg, rgba(0,0,0,0.42), transparent)' }} />
        <div className="relative z-10 max-w-[78%]">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(124,92,255,0.18)', border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)' }}>
            <Sparkles size={19} style={{ color: '#A995FF' }} />
          </div>
          <p className="leading-snug font-black mt-5" style={{ color: '#FFFFFF', fontSize: quoteFontSize, textShadow: '0 3px 16px rgba(0,0,0,0.72)' }}>
            {quote.text}
          </p>
          <p className="text-sm font-bold mt-4" style={{ color: 'rgba(255,255,255,0.78)', textShadow: '0 2px 10px rgba(0,0,0,0.65)' }}>— {quote.author}</p>
        </div>
      </div>

      {/* ── Gamification strip melhorado ───────────────────────────────────
          Clicável: leva direto à tela de Progresso (antes ficava a vários cliques
          dentro de "Meu Espaço"). Mostra o panorama completo da constância. */}
      <button
        type="button"
        onClick={() => navigate('/espaco', { state: { tab: 'progresso' } })}
        className="w-full text-left rounded-2xl p-4 space-y-3 transition-all active:scale-[0.99]"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
        aria-label="Ver progresso e constância">
        {/* Indicadores com rótulo descritivo EM CIMA e unidade JUNTO do número,
            para não confundir (ex.: "2 missões nesta semana", não "2 semanas"). */}
        <div className="flex items-stretch gap-3">
          {/* Sequência (dias seguidos de atividade) */}
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(255,122,107,0.15)', border: '1px solid rgba(255,122,107,0.25)' }}>
              <Flame size={15} style={{ color: '#FF7A6B' }} />
            </div>
            <div className="min-w-0">
              <p className="text-[9px] font-bold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Sequência</p>
              <p className="text-sm font-extrabold leading-tight" style={{ color: 'var(--text-primary)' }}>
                {progress.currentStreak} <span className="font-bold" style={{ color: 'var(--text-muted)' }}>{progress.currentStreak === 1 ? 'dia' : 'dias'}</span>
              </p>
            </div>
          </div>

          <div className="w-px flex-shrink-0" style={{ background: 'var(--bg-card-bright)' }} />

          {/* Missões concluídas nesta semana */}
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(83,214,161,0.12)', border: '1px solid rgba(83,214,161,0.25)' }}>
              <Check size={15} style={{ color: '#53D6A1' }} />
            </div>
            <div className="min-w-0">
              <p className="text-[9px] font-bold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Esta semana</p>
              <p className="text-sm font-extrabold leading-tight" style={{ color: 'var(--text-primary)' }}>
                {progress.weeklyMissions} <span className="font-bold" style={{ color: 'var(--text-muted)' }}>{progress.weeklyMissions === 1 ? 'missão' : 'missões'}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Nível atual — em linha própria, com rótulo claro */}
        <div className="flex items-center gap-2">
          <TrendingUp size={13} style={{ color: '#9B8CFF' }} />
          <span className="text-[9px] font-bold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Nível</span>
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(109,93,246,0.15)', border: '1px solid rgba(109,93,246,0.25)', color: '#9B8CFF' }}>
            {progress.level}
          </span>
        </div>

        {/* Barra de progresso para o próximo nível */}
        {levelInfo.next !== '—' && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}>
                Próximo: {levelInfo.next}
              </p>
              <p className="text-[10px] font-bold tabular-nums" style={{ color: '#9B8CFF' }}>
                {levelProgress}%
              </p>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${levelProgress}%` }} />
            </div>
          </div>
        )}

        {/* Afordância de clique: deixa claro que a barra leva ao progresso. */}
        <div className="flex items-center justify-end gap-1 pt-1">
          <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: '#9B8CFF' }}>
            Ver progresso completo
          </span>
          <ChevronRight size={13} style={{ color: '#9B8CFF' }} />
        </div>
      </button>

      {/* A jornada de constância dia-a-dia (Dia 1→7) vive em "Meu Espaço >
          Progresso" para não repetir o indicador de sequência acima. */}

      {/* ── Aviso de carregamento NÃO-bloqueante ──────────────────────────
          A geração roda em segundo plano. Mostramos um aviso compacto e
          deixamos o usuário navegar livremente (Biblioteca, Meu Espaço…).
          A missão fica salva e aparece aqui quando estiver pronta. */}
      {busy && (
        <div className="app-card rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--brand-soft)', border: '1px solid var(--brand-border)' }}>
            <Sparkles size={18} style={{ color: 'var(--brand)' }} className="animate-pulse" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-extrabold text-sm" style={{ color: 'var(--text-primary)' }}>Destravando suas ideias...</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              Costuma levar ~10–15s. Pode continuar navegando — sua missão aparece aqui quando ficar pronta.
            </p>
          </div>
          <div className="flex gap-1 flex-shrink-0">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ background: '#9B8CFF', animationDelay: `${i * 0.25}s` }} />
            ))}
          </div>
        </div>
      )}

      {/* ── Check-in / conteúdo ─────────────────────── */}
      {!checkin ? (
        <div className="space-y-3"
          style={{ opacity: loading ? 0.45 : 1, pointerEvents: loading ? 'none' : 'auto', transition: 'opacity 0.2s' }}>
          <p className="section-title">Como está seu dia?</p>
          <div className="grid grid-cols-2 gap-2.5">
            {checkinOptions.map((opt, index) => {
              const Icon = opt.Icon
              const isLastWide = checkinOptions.length % 2 === 1 && index === checkinOptions.length - 1
              return (
                <button
                  key={opt.value + opt.label}
                  onClick={() => handleCheckin(opt.value)}
                  className={`text-left p-3 rounded-[20px] transition-all duration-200 active:scale-[0.98] flex items-center gap-3 min-h-[72px] ${isLastWide ? 'col-span-2' : ''}`}
                  style={{ background: 'var(--interactive-bg)', border: '1px solid var(--interactive-border)' }}
                  onMouseEnter={e => {
                    ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(124,92,255,0.10)'
                    ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(124,92,255,0.20)'
                  }}
                  onMouseLeave={e => {
                    ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--interactive-bg)'
                    ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--interactive-border)'
                  }}
                >
                  <div className="w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(124,92,255,0.12)' }}>
                    <Icon size={15} style={{ color: '#9B8CFF' }} />
                  </div>
                  <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{opt.label}</span>
                </button>
              )
            })}
          </div>

          {/* Surpreenda-me — ação tonal de delight (acento de marca, sem glow) */}
          {profile && (
            <button onClick={handleSurprise} className="btn-tonal w-full text-sm">
              <Wand2 size={15} /> Surpreenda-me — destravar uma ideia agora
            </button>
          )}
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
                onRecord={(override) => setStudioIdea(override ?? mission)}
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
                    onRecord={(override) => setStudioIdea(override ?? idea)}
                    onCaption={() => handleCaption(idea)} />
                ))}
              </div>
            </div>
          )}

          <button onClick={() => navigate('/criar')} className="btn-secondary w-full">
            <Sparkles size={16} /> Criar mais ideias <ArrowRight size={16} />
          </button>

          {/* Reiniciar — discreto para não confundir usuários novos */}
          <button
            onClick={() => {
              void deleteDailyCheckin(TODAY_KEY).catch(err => console.error('[Home reset day]', err))
              resetTodayContent()
            }}
            className="w-full text-center text-[11px] py-2 opacity-40 hover:opacity-70 transition-opacity"
            style={{ color: 'var(--text-muted)' }}
          >
            Recomeçar o dia
          </button>
        </div>
      )}

      {/* CTA essência vazia */}
      {!checkin && !(profile?.pillars.length) && (
        <div className="relative rounded-2xl p-5 overflow-hidden app-card">
          <p className="font-extrabold text-lg mb-1" style={{ color: 'var(--text-primary)' }}>Complete sua essência</p>
          <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>Quanto mais você preenche, mais personalizadas ficam as ideias.</p>
          <button onClick={() => navigate('/essencia')} className="btn-primary text-sm py-2.5 px-4">
            Ver Minha Essência <ChevronRight size={14} />
          </button>
        </div>
      )}

      {/* Atalho para a Agenda — planejar a semana sem precisar caçar na navbar */}
      <button onClick={() => navigate('/calendario')}
        className="w-full rounded-2xl p-4 flex items-center gap-3 text-left transition-all active:scale-[0.99]"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(109,93,246,0.12)', border: '1px solid rgba(109,93,246,0.2)' }}>
          <CalendarDays size={17} style={{ color: '#9B8CFF' }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Planejar minha semana</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Organize o que postar na Agenda.</p>
        </div>
        <ChevronRight size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
      </button>

      {studioIdea && (
        <StudioModal idea={studioIdea} onClose={() => setStudioIdea(null)} />
      )}

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
      </>
      )}
    </div>
  )
}
