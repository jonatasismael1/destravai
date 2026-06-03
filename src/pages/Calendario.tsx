import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, ChevronLeft, ChevronRight, Clock, Plus, Sparkles, X, Camera, Copy, Check, Trash2, CalendarClock } from 'lucide-react'
import { useApp } from '../context/AppContext'
import type { ContentIdea, ExposureLevel } from '../types'
import type { CalendarItem, LibraryItem } from '../lib/supabase/types'
import { getLibraryItems } from '../services/libraryService'
import { addCalendarItem, loadCalendarItems, removeCalendarItem, updateCalendarItemStatus, moveCalendarItem, toISODateKey } from '../services/userJourneyService'
import { trackEvent } from '../services/eventsService'
import StudioModal from '../components/StudioModal'

const STATUS_META: Record<CalendarItem['status'], { label: string; color: string; bg: string }> = {
  planned:  { label: 'Planejado', color: '#9B8CFF', bg: 'rgba(124,92,255,0.15)' },
  recorded: { label: 'Gravado',   color: '#F7B955', bg: 'rgba(247,185,85,0.15)' },
  posted:   { label: 'Postado',   color: '#53D6A1', bg: 'rgba(83,214,161,0.15)' },
  skipped:  { label: 'Pulado',    color: 'var(--text-muted)', bg: 'var(--bg-input)' },
}
const STATUS_CYCLE: CalendarItem['status'][] = ['planned', 'recorded', 'posted']

function dateKey(d: Date): string {
  return toISODateKey(d)
}

function getWeekDays(ref: Date): Date[] {
  const monday = new Date(ref)
  monday.setDate(ref.getDate() - ((ref.getDay() + 6) % 7))
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

const DAY_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
const MONTH_NAMES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

const TYPE_META: Record<string, { icon: string; label: string }> = {
  story: { icon: '📱', label: 'Story' },
  sequence: { icon: '🎞️', label: 'Sequência' },
  reel: { icon: '🎬', label: 'Reels' },
}

function ideaTypeFromLibrary(item: LibraryItem): ContentIdea['type'] {
  if (item.type === 'reels_script') return 'reel'
  if (item.type === 'story_sequence') return 'sequence'
  return 'story'
}

function libraryItemToIdea(item: LibraryItem): ContentIdea {
  const metadata = item.metadata ?? {}
  return {
    id: item.id,
    type: ideaTypeFromLibrary(item),
    theme: item.title,
    objective: item.category ?? item.format ?? 'Conteúdo salvo na biblioteca',
    content: item.content,
    cta: typeof metadata.cta === 'string' ? metadata.cta : '',
    timeEstimate: typeof metadata.timeEstimate === 'string' ? metadata.timeEstimate : '5 min',
    exposureLevel: (typeof metadata.exposureLevel === 'string' ? metadata.exposureLevel : 'short-videos') as ExposureLevel,
    status: item.status === 'done' ? 'done' : 'saved',
    favorite: item.is_favorite,
    createdAt: item.created_at,
    tags: item.tags ?? [],
  }
}

function calendarIdea(item: CalendarItem): ContentIdea {
  return item.idea_snapshot as unknown as ContentIdea
}

function IdeaPickerSheet({ ideas, onPick, onClose }: {
  ideas: ContentIdea[]
  onPick: (id: string) => void
  onClose: () => void
}) {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')

  const filtered = ideas.filter(i =>
    i.theme.toLowerCase().includes(search.toLowerCase()) ||
    i.objective.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col justify-end"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="rounded-t-3xl flex flex-col max-h-[75vh]"
        style={{ background: 'var(--bg-card)', borderTop: '1px solid var(--border-color)' }}>
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <p className="font-extrabold text-base" style={{ color: 'var(--text-primary)' }}>Adicionar ideia</p>
          <button onClick={onClose} style={{ color: 'var(--text-muted)' }}><X size={18} /></button>
        </div>

        <div className="px-5 pb-3">
          <button
            onClick={() => { navigate('/criar'); onClose() }}
            className="btn-tonal w-full py-3 text-sm"
          >
            <Sparkles size={14} /> Gerar nova ideia
          </button>
        </div>

        {ideas.length > 0 ? (
          <>
            <div className="px-5 pb-3">
              <input
                className="input text-sm"
                placeholder="Buscar na biblioteca..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="flex-1 overflow-y-auto px-5 pb-8 space-y-2">
              {filtered.length === 0 ? (
                <p className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>Nenhuma ideia encontrada</p>
              ) : filtered.map(idea => {
                const meta = TYPE_META[idea.type] ?? { icon: '📝', label: idea.type }
                return (
                  <button
                    key={idea.id}
                    onClick={() => onPick(idea.id)}
                    className="w-full text-left rounded-2xl p-4 transition-all active:scale-[0.98]"
                    style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)' }}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-lg mt-0.5">{meta.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm truncate" style={{ color: 'var(--text-primary)' }}>{idea.theme}</p>
                        <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-secondary)' }}>{idea.objective}</p>
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <span className="tag tag-purple text-[9px]">{meta.label}</span>
                          <span className="flex items-center gap-0.5 text-[9px] font-bold" style={{ color: 'var(--text-muted)' }}>
                            <Clock size={8} /> {idea.timeEstimate}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 py-8 px-5">
            <BookOpen size={32} style={{ color: 'var(--text-muted)' }} />
            <p className="text-sm text-center" style={{ color: 'var(--text-secondary)' }}>
              Você ainda não tem ideias salvas na biblioteca.<br />Gere uma nova agora!
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// Modal com os detalhes do conteúdo planejado: roteiro completo, status,
// gravar (teleprompter), copiar, mover de dia e excluir.
function CalendarDetailSheet({ item, onClose, onRecord, onCycleStatus, onRemove, onMove }: {
  item: CalendarItem
  onClose: () => void
  onRecord: (idea: ContentIdea) => void
  onCycleStatus: (item: CalendarItem) => void
  onRemove: (id: string) => void
  onMove: (id: string, dayKey: string) => void
}) {
  const idea = item.idea_snapshot as unknown as ContentIdea
  const meta = TYPE_META[idea.type] ?? { icon: '📝', label: idea.type }
  const [copied, setCopied] = useState(false)
  const [moving, setMoving] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(idea.content + (idea.cta ? `\n\nCTA: ${idea.cta}` : ''))
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-[120] flex flex-col justify-end"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="rounded-t-3xl flex flex-col max-h-[85vh]"
        style={{ background: 'var(--bg-card)', borderTop: '1px solid var(--border-color)' }}>
        <div className="flex items-start justify-between px-5 pt-5 pb-2 gap-3">
          <div className="flex items-start gap-2.5 min-w-0">
            <span className="text-xl mt-0.5">{meta.icon}</span>
            <div className="min-w-0">
              <p className="font-extrabold text-base leading-snug" style={{ color: 'var(--text-primary)' }}>{idea.theme}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{idea.objective}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ color: 'var(--text-muted)' }} aria-label="Fechar"><X size={18} /></button>
        </div>

        {/* Status atual (toca para avançar) */}
        <div className="px-5 pb-3 flex items-center gap-2 flex-wrap">
          <span className="tag tag-purple text-[10px]">{meta.label}</span>
          <span className="flex items-center gap-1 text-[10px] font-bold" style={{ color: 'var(--text-muted)' }}>
            <Clock size={9} /> {idea.timeEstimate}
          </span>
          <button onClick={() => onCycleStatus(item)}
            className="text-[10px] font-bold px-2.5 py-1 rounded-full transition-all active:scale-95"
            style={{ background: STATUS_META[item.status].bg, color: STATUS_META[item.status].color }}
            title="Tocar para mudar: Planejado → Gravado → Postado">
            {STATUS_META[item.status].label} ›
          </button>
        </div>

        {/* Roteiro completo */}
        <div className="flex-1 overflow-y-auto px-5 pb-3">
          <div className="rounded-2xl p-4" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)' }}>
            <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed" style={{ color: 'var(--text-primary)' }}>
              {idea.content || 'Sem roteiro detalhado.'}
            </pre>
          </div>
          {idea.cta && (
            <div className="rounded-2xl p-3 mt-3" style={{ background: 'rgba(255,122,107,0.08)', border: '1px solid rgba(255,122,107,0.2)' }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#FF7A6B' }}>CTA</p>
              <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{idea.cta}</p>
            </div>
          )}

          {/* Mover para outro dia */}
          {moving && (
            <div className="mt-3 rounded-2xl p-3" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)' }}>
              <p className="text-xs font-bold mb-2" style={{ color: 'var(--text-secondary)' }}>Mover para:</p>
              <input
                type="date"
                defaultValue={typeof item.day_key === 'string' ? item.day_key.slice(0, 10) : ''}
                onChange={e => { if (e.target.value) { onMove(item.id, e.target.value); onClose() } }}
                className="input text-sm"
              />
            </div>
          )}
        </div>

        {/* Ações */}
        <div className="px-5 pb-8 pt-2 space-y-2" style={{ borderTop: '1px solid var(--border-color)' }}>
          <div className="flex gap-2">
            <button onClick={() => onRecord(idea)} className="btn-primary flex-1 py-3 text-sm">
              <Camera size={15} /> Gravar
            </button>
            <button onClick={handleCopy} className="btn-secondary py-3 px-4 text-sm" title="Copiar roteiro">
              {copied ? <Check size={15} /> : <Copy size={15} />}
            </button>
            <button onClick={() => setMoving(m => !m)} className="btn-secondary py-3 px-4 text-sm" title="Mover para outro dia">
              <CalendarClock size={15} />
            </button>
          </div>
          <button onClick={() => { onRemove(item.id); onClose() }}
            className="w-full py-2.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-1.5 transition-all"
            style={{ background: 'rgba(255,59,48,0.08)', color: '#FF6B6B', border: '1px solid rgba(255,59,48,0.2)' }}>
            <Trash2 size={14} /> Remover do calendário
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Calendario() {
  const { state } = useApp()
  const [weekRef, setWeekRef] = useState(new Date())
  const [calendarItems, setCalendarItems] = useState<CalendarItem[]>([])
  const [remoteIdeas, setRemoteIdeas] = useState<ContentIdea[]>([])
  const [pickerDate, setPickerDate] = useState<string | null>(null)
  const [view, setView] = useState<'week' | 'month'>('week')
  const [monthItems, setMonthItems] = useState<CalendarItem[]>([])
  const [detailItem, setDetailItem] = useState<CalendarItem | null>(null)
  const [studioIdea, setStudioIdea] = useState<ContentIdea | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverDay, setDragOverDay] = useState<string | null>(null)

  const weekDays = getWeekDays(weekRef)
  const today = dateKey(new Date())
  const startDay = dateKey(weekDays[0])
  const endDay = dateKey(weekDays[6])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const items = await loadCalendarItems(startDay, endDay)
        if (!cancelled) setCalendarItems(items)
      } catch (err) {
        console.error('[Calendario items]', err)
        if (!cancelled) setCalendarItems([])
      }
    })()
    return () => { cancelled = true }
  }, [startDay, endDay])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { items } = await getLibraryItems({ pageSize: 100 })
        if (!cancelled) setRemoteIdeas(items.map(libraryItemToIdea))
      } catch (err) {
        console.error('[Calendario library]', err)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const libraryIdeas = useMemo(() => {
    const byId = new Map<string, ContentIdea>()
    ;[...remoteIdeas, ...state.ideas].forEach(idea => {
      if (idea.status !== 'done') byId.set(idea.id, idea)
    })
    return Array.from(byId.values())
  }, [remoteIdeas, state.ideas])

  const prevWeek = () => {
    const d = new Date(weekRef)
    if (view === 'month') d.setMonth(d.getMonth() - 1)
    else d.setDate(d.getDate() - 7)
    setWeekRef(d)
  }

  const nextWeek = () => {
    const d = new Date(weekRef)
    if (view === 'month') d.setMonth(d.getMonth() + 1)
    else d.setDate(d.getDate() + 7)
    setWeekRef(d)
  }

  const goToday = () => setWeekRef(new Date())

  // Dias do mês de weekRef (para a visão mensal).
  const monthGridDays = useMemo(() => {
    const first = new Date(weekRef.getFullYear(), weekRef.getMonth(), 1)
    const total = new Date(weekRef.getFullYear(), weekRef.getMonth() + 1, 0).getDate()
    const pad = (first.getDay() + 6) % 7 // segunda-feira como início
    const cells: (Date | null)[] = Array.from({ length: pad }, () => null)
    for (let i = 1; i <= total; i++) cells.push(new Date(weekRef.getFullYear(), weekRef.getMonth(), i))
    return cells
  }, [weekRef])

  const addIdea = async (dayKey: string, ideaId: string) => {
    const idea = libraryIdeas.find(i => i.id === ideaId)
    if (!idea) return

    try {
      const item = await addCalendarItem(dayKey, idea)
      setCalendarItems(prev => [
        ...prev.filter(i => !(i.day_key === dayKey && i.idea_id === ideaId)),
        item,
      ])
    } catch (err) {
      console.error('[Calendario add]', err)
    } finally {
      setPickerDate(null)
    }
  }

  const removeIdea = async (itemId: string) => {
    setCalendarItems(prev => prev.filter(i => i.id !== itemId))
    await removeCalendarItem(itemId).catch(err => console.error('[Calendario remove]', err))
  }

  // Move um item para outro dia (usado pelo arrastar-soltar e pelo modal).
  const moveIdea = async (itemId: string, newDayKey: string) => {
    const current = calendarItems.find(i => i.id === itemId)
    if (!current || current.day_key === newDayKey) return
    setCalendarItems(prev => prev.map(i => i.id === itemId ? { ...i, day_key: newDayKey } : i))
    await moveCalendarItem(itemId, newDayKey).catch(err => console.error('[Calendario move]', err))
  }

  // Solta o item arrastado em um dia da semana.
  const handleDropOnDay = (dayKey: string) => {
    if (draggingId) void moveIdea(draggingId, dayKey)
    setDraggingId(null)
    setDragOverDay(null)
  }

  // Avança o status: planejado → gravado → postado (e volta ao começo).
  const cycleStatus = async (item: CalendarItem) => {
    const idx = STATUS_CYCLE.indexOf(item.status)
    const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length]
    setCalendarItems(prev => prev.map(i => i.id === item.id ? { ...i, status: next } : i))
    await updateCalendarItemStatus(item.id, next).catch(err => console.error('[Calendario status]', err))
    if (next === 'posted') void trackEvent('posted', item.idea_id)
  }

  // Carrega os itens do mês inteiro para a visão mensal.
  useEffect(() => {
    if (view !== 'month') return
    let cancelled = false
    const first = new Date(weekRef.getFullYear(), weekRef.getMonth(), 1)
    const last = new Date(weekRef.getFullYear(), weekRef.getMonth() + 1, 0)
    ;(async () => {
      try {
        const items = await loadCalendarItems(dateKey(first), dateKey(last))
        if (!cancelled) setMonthItems(items)
      } catch (err) {
        console.error('[Calendario month]', err)
      }
    })()
    return () => { cancelled = true }
  }, [view, weekRef])

  const weekLabel = (() => {
    if (view === 'month') {
      return `${MONTH_NAMES[weekRef.getMonth()]} de ${weekRef.getFullYear()}`
    }
    const first = weekDays[0]
    const last = weekDays[6]
    if (first.getMonth() === last.getMonth()) {
      return `${first.getDate()}-${last.getDate()} de ${MONTH_NAMES[first.getMonth()]}`
    }
    return `${first.getDate()} ${MONTH_NAMES[first.getMonth()]} - ${last.getDate()} ${MONTH_NAMES[last.getMonth()]}`
  })()

  const totalPlanned = calendarItems.length

  return (
    <div className="flex flex-col min-h-screen">
      <div className="px-5 pt-8 pb-3 relative z-10">
        <h1 className="text-3xl font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>
          Calendário
        </h1>
        <p className="text-sm mt-1 font-medium" style={{ color: 'var(--text-secondary)' }}>
          Planeje seu conteúdo
        </p>

        <div className="segmented-control mt-3">
          {(['week', 'month'] as const).map(v => (
            <button key={v} type="button" data-active={view === v} onClick={() => setView(v)}>
              {v === 'week' ? 'Semana' : 'Mês'}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between mt-4">
          <button
            onClick={prevWeek}
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
          >
            <ChevronLeft size={16} style={{ color: 'var(--text-muted)' }} />
          </button>

          <div className="text-center">
            <p className="text-sm font-extrabold" style={{ color: 'var(--text-primary)' }}>{weekLabel}</p>
            {totalPlanned > 0 && (
              <p className="text-[10px] font-bold mt-0.5" style={{ color: '#9B8CFF' }}>
                {totalPlanned} conteúdo{totalPlanned > 1 ? 's' : ''} planejado{totalPlanned > 1 ? 's' : ''}
              </p>
            )}
          </div>

          <button
            onClick={nextWeek}
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
          >
            <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
          </button>
        </div>

        {dateKey(weekRef) !== today && !weekDays.some(d => dateKey(d) === today) && (
          <button
            onClick={goToday}
            className="w-full mt-2 py-1.5 rounded-xl text-xs font-bold"
            style={{ background: 'rgba(109,93,246,0.08)', color: '#9B8CFF', border: '1px solid rgba(109,93,246,0.2)' }}
          >
            Ir para a semana atual
          </button>
        )}
      </div>

      <div className="flex-1 px-5 pb-28 space-y-3 overflow-y-auto relative z-10">
        {view === 'week' && weekDays.map((day, i) => {
          const key = dateKey(day)
          const isToday = key === today
          const isPast = day < new Date(today)
          const assignedItems = calendarItems.filter(item => item.day_key === key)

          const isDropTarget = dragOverDay === key
          return (
            <div
              key={key}
              className="rounded-3xl overflow-hidden transition-all"
              onDragOver={e => { if (draggingId) { e.preventDefault(); setDragOverDay(key) } }}
              onDragLeave={() => { if (dragOverDay === key) setDragOverDay(null) }}
              onDrop={() => handleDropOnDay(key)}
              style={isDropTarget ? {
                background: 'rgba(109,93,246,0.18)',
                border: '1px dashed rgba(109,93,246,0.6)',
                boxShadow: '0 0 24px rgba(109,93,246,0.25)',
              } : isToday ? {
                background: 'var(--brand-soft)',
                border: '1px solid var(--brand-border)',
              } : {
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                boxShadow: 'var(--shadow-card)',
                opacity: isPast && !isToday ? 0.65 : 1,
              }}
            >
              <div className="flex items-center justify-between px-4 pt-4 pb-2">
                <div className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-extrabold"
                    style={isToday ? {
                      background: 'var(--brand)',
                      color: '#fff',
                    } : {
                      background: 'var(--bg-input)',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {day.getDate()}
                  </div>
                  <div>
                    <p className="text-sm font-extrabold" style={{ color: isToday ? '#9B8CFF' : 'var(--text-primary)' }}>
                      {DAY_LABELS[i]}
                      {isToday && <span className="ml-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ background: 'rgba(109,93,246,0.2)', color: '#9B8CFF' }}>hoje</span>}
                    </p>
                    <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      {MONTH_NAMES[day.getMonth()]}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setPickerDate(key)}
                  className="w-7 h-7 rounded-xl flex items-center justify-center transition-all active:scale-90"
                  style={{ background: 'rgba(109,93,246,0.12)', border: '1px solid rgba(109,93,246,0.2)' }}
                >
                  <Plus size={14} style={{ color: '#9B8CFF' }} />
                </button>
              </div>

              {assignedItems.length > 0 ? (
                <div className="px-4 pb-4 space-y-2">
                  {assignedItems.map(item => {
                    const idea = calendarIdea(item)
                    const meta = TYPE_META[idea.type] ?? { icon: '📝', label: idea.type }
                    return (
                      <div
                        key={item.id}
                        draggable
                        onDragStart={() => setDraggingId(item.id)}
                        onDragEnd={() => { setDraggingId(null); setDragOverDay(null) }}
                        onClick={() => setDetailItem(item)}
                        className="flex items-center gap-2.5 rounded-2xl px-3 py-2.5 cursor-pointer transition-all active:scale-[0.98]"
                        style={{
                          background: 'var(--bg-input)',
                          border: '1px solid var(--border-color)',
                          opacity: draggingId === item.id ? 0.4 : 1,
                        }}
                        title="Toque para ver detalhes · arraste para mover de dia"
                      >
                        <span className="text-base flex-shrink-0">{meta.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold truncate" style={{ color: 'var(--text-primary)' }}>{idea.theme}</p>
                          <p className="text-[9px] font-semibold" style={{ color: 'var(--text-muted)' }}>{meta.label} · {idea.timeEstimate}</p>
                        </div>
                        <button
                          onClick={e => { e.stopPropagation(); cycleStatus(item) }}
                          className="text-[9px] font-bold px-2 py-1 rounded-full flex-shrink-0 transition-all active:scale-95"
                          style={{ background: STATUS_META[item.status].bg, color: STATUS_META[item.status].color }}
                          title="Tocar para mudar: Planejado → Gravado → Postado"
                        >
                          {STATUS_META[item.status].label}
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); removeIdea(item.id) }}
                          className="w-5 h-5 rounded-lg flex items-center justify-center flex-shrink-0 transition-all active:scale-90"
                          style={{ background: 'rgba(255,59,48,0.1)' }}
                        >
                          <X size={10} style={{ color: '#FF6B6B' }} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <button
                  onClick={() => setPickerDate(key)}
                  className="w-full px-4 pb-4 flex items-center gap-2 text-xs font-semibold transition-all"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <span className="w-4 h-4 rounded-md flex items-center justify-center" style={{ background: 'var(--bg-input)' }}>
                    <Plus size={10} />
                  </span>
                  Nenhum conteúdo planejado
                </button>
              )}
            </div>
          )
        })}

        {view === 'month' && (
          <div>
            <div className="grid grid-cols-7 gap-1 mb-1">
              {DAY_LABELS.map(d => (
                <span key={d} className="text-center text-[9px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>{d}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {monthGridDays.map((day, idx) => {
                if (!day) return <div key={`pad-${idx}`} />
                const key = dateKey(day)
                const count = monthItems.filter(it => it.day_key === key).length
                const isToday = key === today
                const posted = monthItems.some(it => it.day_key === key && it.status === 'posted')
                return (
                  <button
                    key={key}
                    onClick={() => { setWeekRef(day); setView('week') }}
                    className="aspect-square rounded-xl flex flex-col items-center justify-center transition-all active:scale-95"
                    style={isToday ? {
                      background: 'var(--brand-soft)',
                      border: '1px solid var(--brand-border)',
                    } : {
                      background: count > 0 ? 'var(--bg-elevated)' : 'transparent',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <span className="text-xs font-bold" style={{ color: isToday ? '#9B8CFF' : 'var(--text-primary)' }}>{day.getDate()}</span>
                    {count > 0 && (
                      <span className="mt-0.5 w-1.5 h-1.5 rounded-full"
                        style={{ background: posted ? '#53D6A1' : '#9B8CFF' }} />
                    )}
                  </button>
                )
              })}
            </div>
            <p className="text-[10px] text-center mt-3" style={{ color: 'var(--text-muted)' }}>
              Toque em um dia para planejar a semana dele.
            </p>
          </div>
        )}
      </div>

      {pickerDate && (
        <IdeaPickerSheet
          ideas={libraryIdeas}
          onPick={(id) => addIdea(pickerDate, id)}
          onClose={() => setPickerDate(null)}
        />
      )}

      {detailItem && (
        <CalendarDetailSheet
          item={detailItem}
          onClose={() => setDetailItem(null)}
          onRecord={(idea) => { setStudioIdea(idea); setDetailItem(null) }}
          onCycleStatus={(it) => { cycleStatus(it); setDetailItem(prev => prev && prev.id === it.id ? { ...prev, status: STATUS_CYCLE[(STATUS_CYCLE.indexOf(it.status) + 1) % STATUS_CYCLE.length] } : prev) }}
          onRemove={removeIdea}
          onMove={moveIdea}
        />
      )}

      {studioIdea && (
        <StudioModal idea={studioIdea} onClose={() => setStudioIdea(null)} />
      )}
    </div>
  )
}
