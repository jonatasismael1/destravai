import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Plus, X, Sparkles, Clock, BookOpen } from 'lucide-react'
import type { ContentIdea } from '../types'

const STORAGE_KEY = 'destravai-calendar'
type CalendarData = Record<string, string[]> // dateKey → ideaId[]

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
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

function loadCalendar(): CalendarData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

function saveCalendar(data: CalendarData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

// Sheet para selecionar ideia da biblioteca
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
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <p className="font-extrabold text-base" style={{ color: 'var(--text-primary)' }}>Adicionar ideia</p>
          <button onClick={onClose} style={{ color: 'var(--text-muted)' }}><X size={18} /></button>
        </div>

        {/* Gerar nova */}
        <div className="px-5 pb-3">
          <button
            onClick={() => { navigate('/criar'); onClose() }}
            className="w-full py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg, rgba(109,93,246,0.15), rgba(155,140,255,0.08))', border: '1px solid rgba(109,93,246,0.3)', color: '#9B8CFF' }}
          >
            <Sparkles size={14} /> Gerar nova ideia
          </button>
        </div>

        {ideas.length > 0 && (
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
        )}

        {ideas.length === 0 && (
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

export default function Calendario() {
  const { state } = useApp()
  const [weekRef, setWeekRef] = useState(new Date())
  const [calendar, setCalendar] = useState<CalendarData>(loadCalendar)
  const [pickerDate, setPickerDate] = useState<string | null>(null)

  const weekDays = getWeekDays(weekRef)
  const today = dateKey(new Date())

  // Ideias disponíveis para adicionar (salvas ou da biblioteca)
  const libraryIdeas = state.ideas.filter(i => i.status !== 'done')

  const prevWeek = () => {
    const d = new Date(weekRef)
    d.setDate(d.getDate() - 7)
    setWeekRef(d)
  }

  const nextWeek = () => {
    const d = new Date(weekRef)
    d.setDate(d.getDate() + 7)
    setWeekRef(d)
  }

  const goToday = () => setWeekRef(new Date())

  const addIdea = (dayKey: string, ideaId: string) => {
    const updated = { ...calendar }
    const existing = updated[dayKey] ?? []
    if (!existing.includes(ideaId)) {
      updated[dayKey] = [...existing, ideaId]
      setCalendar(updated)
      saveCalendar(updated)
    }
    setPickerDate(null)
  }

  const removeIdea = (dayKey: string, ideaId: string) => {
    const updated = { ...calendar }
    updated[dayKey] = (updated[dayKey] ?? []).filter(id => id !== ideaId)
    setCalendar(updated)
    saveCalendar(updated)
  }

  const weekLabel = (() => {
    const first = weekDays[0]
    const last = weekDays[6]
    if (first.getMonth() === last.getMonth()) {
      return `${first.getDate()}–${last.getDate()} de ${MONTH_NAMES[first.getMonth()]}`
    }
    return `${first.getDate()} ${MONTH_NAMES[first.getMonth()]} – ${last.getDate()} ${MONTH_NAMES[last.getMonth()]}`
  })()

  const totalPlanned = weekDays.reduce((acc, d) => acc + (calendar[dateKey(d)]?.length ?? 0), 0)

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <div className="px-5 pt-8 pb-3 relative z-10">
        <h1 className="text-3xl font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>
          Calendário
        </h1>
        <p className="text-sm mt-1 font-medium" style={{ color: 'var(--text-secondary)' }}>
          Planeje seu conteúdo da semana
        </p>

        {/* Week nav */}
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

        {/* Botão voltar para hoje */}
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

      {/* Days list */}
      <div className="flex-1 px-5 pb-28 space-y-3 overflow-y-auto relative z-10">
        {weekDays.map((day, i) => {
          const key = dateKey(day)
          const isToday = key === today
          const isPast = day < new Date(today)
          const assignedIds = calendar[key] ?? []
          const assignedIdeas = assignedIds
            .map(id => state.ideas.find(idea => idea.id === id))
            .filter(Boolean) as ContentIdea[]

          return (
            <div
              key={key}
              className="rounded-3xl overflow-hidden"
              style={isToday ? {
                background: 'linear-gradient(135deg, rgba(109,93,246,0.12), rgba(155,140,255,0.06))',
                border: '1px solid rgba(109,93,246,0.3)',
                boxShadow: '0 0 20px rgba(109,93,246,0.1)',
              } : {
                background: 'var(--bg-card)',
                border: `1px solid ${isPast ? 'var(--border-color)' : 'var(--border-color)'}`,
                opacity: isPast && !isToday ? 0.65 : 1,
              }}
            >
              {/* Day header */}
              <div className="flex items-center justify-between px-4 pt-4 pb-2">
                <div className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-extrabold"
                    style={isToday ? {
                      background: 'linear-gradient(135deg, #6D5DF6, #9B8CFF)',
                      color: '#fff',
                      boxShadow: '0 0 12px rgba(109,93,246,0.4)',
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

              {/* Assigned ideas */}
              {assignedIdeas.length > 0 ? (
                <div className="px-4 pb-4 space-y-2">
                  {assignedIdeas.map(idea => {
                    const meta = TYPE_META[idea.type] ?? { icon: '📝', label: idea.type }
                    return (
                      <div
                        key={idea.id}
                        className="flex items-center gap-2.5 rounded-2xl px-3 py-2.5"
                        style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)' }}
                      >
                        <span className="text-base flex-shrink-0">{meta.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold truncate" style={{ color: 'var(--text-primary)' }}>{idea.theme}</p>
                          <p className="text-[9px] font-semibold" style={{ color: 'var(--text-muted)' }}>{meta.label} · {idea.timeEstimate}</p>
                        </div>
                        <button
                          onClick={() => removeIdea(key, idea.id)}
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
      </div>

      {/* Idea picker sheet */}
      {pickerDate && (
        <IdeaPickerSheet
          ideas={libraryIdeas}
          onPick={(id) => addIdea(pickerDate, id)}
          onClose={() => setPickerDate(null)}
        />
      )}
    </div>
  )
}
