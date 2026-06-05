import { useState } from 'react'
import { Plus, Trash2, Sparkles, Loader2, ChevronDown, ChevronUp, Settings2, X } from 'lucide-react'
import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import PersonalSetupModal from '../components/PersonalSetupModal'
import ProgressoPanel from '../components/ProgressoPanel'
import Biblioteca from './Biblioteca'
import type { JournalEntry, PersonalIdea } from '../types'
import { generatePersonalSuggestions } from '../lib/ai'
import { toISODateKey } from '../services/userJourneyService'
import { useScreenTour } from '../context/OnboardingContext'

// Paleta do Espaço — usa as CSS variables globais do tema
const C = {
  brand:    '#6D5DF6',
  brandBg:  'rgba(109,93,246,0.08)',
}

const MOODS = [
  { emoji: '🔥', label: 'Motivado' },
  { emoji: '😊', label: 'Bem' },
  { emoji: '⭐', label: 'Ótimo' },
  { emoji: '😌', label: 'Tranquilo' },
  { emoji: '🤔', label: 'Pensativo' },
  { emoji: '😴', label: 'Cansado' },
  { emoji: '😤', label: 'Sobrecarregado' },
  { emoji: '😟', label: 'Preocupado' },
]

const IDEA_CATEGORIES: PersonalIdea['category'][] = ['conteúdo', 'pessoal', 'livre']
const CATEGORY_COLORS: Record<PersonalIdea['category'], { bg: string; text: string }> = {
  'conteúdo': { bg: 'rgba(109,93,246,0.12)', text: '#6D5DF6' },
  'pessoal': { bg: 'rgba(83,214,161,0.15)', text: '#1D9A72' },
  'livre': { bg: 'rgba(247,185,85,0.18)', text: '#B07A10' },
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function MeuEspaco() {
  const { state, setTodayMood, addJournalEntry, deleteJournalEntry, addPersonalIdea, deletePersonalIdea } = useApp()
  const { personalSpace } = state
  const profile = state.localProfile
  const { context, journal, ideas, todayMood, todayMoodNote, todayMoodDate } = personalSpace
  const today = toISODateKey()

  useScreenTour('espaco')

  const [showSetup, setShowSetup] = useState(false)
  // Aba inicial pode vir da navegação (ex: clique na barra de constância da Home,
  // que envia { tab: 'progresso' }). Sem isso, abre em "Meu espaço".
  const location = useLocation()
  const initialTab = (location.state as { tab?: 'espaco' | 'progresso' | 'biblioteca' } | null)?.tab ?? 'espaco'
  const [tab, setTab] = useState<'espaco' | 'progresso' | 'biblioteca'>(initialTab)
  const [selectedMood, setSelectedMood] = useState(
    todayMoodDate === today ? (todayMood ?? '') : ''
  )
  const [moodNote, setMoodNote] = useState(
    todayMoodDate === today ? (todayMoodNote ?? '') : ''
  )
  const [moodSaved, setMoodSaved] = useState(todayMoodDate === today && !!todayMood)

  useEffect(() => {
    if (todayMoodDate === today && todayMood) {
      setSelectedMood(todayMood)
      setMoodNote(todayMoodNote ?? '')
      setMoodSaved(true)
    }
  }, [todayMood, todayMoodDate, todayMoodNote, today])

  // Journal
  const [journalOpen, setJournalOpen] = useState(false)
  const [journalText, setJournalText] = useState('')
  const [journalMood, setJournalMood] = useState('')
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null)

  // Ideas
  const [ideaText, setIdeaText] = useState('')
  const [ideaCategory, setIdeaCategory] = useState<PersonalIdea['category']>('livre')

  // AI suggestions
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [suggestionsError, setSuggestionsError] = useState('')

  const hasSetup = context.setupCompleted
  const showSetupBanner = !hasSetup && !context.setupSkipped

  function saveMood() {
    if (!selectedMood) return
    setTodayMood(selectedMood, moodNote)
    setMoodSaved(true)
  }

  function editMood() {
    setMoodSaved(false)
  }

  function saveJournalEntry() {
    if (!journalText.trim()) return
    const entry: JournalEntry = {
      id: crypto.randomUUID(),
      content: journalText.trim(),
      mood: journalMood || '📝',
      date: new Date().toISOString(),
    }
    addJournalEntry(entry)
    setJournalText('')
    setJournalMood('')
    setJournalOpen(false)
  }

  function saveIdea() {
    if (!ideaText.trim()) return
    const idea: PersonalIdea = {
      id: crypto.randomUUID(),
      content: ideaText.trim(),
      category: ideaCategory,
      createdAt: new Date().toISOString(),
    }
    addPersonalIdea(idea)
    setIdeaText('')
  }

  async function loadSuggestions() {
    if (!profile) return
    setLoadingSuggestions(true)
    setSuggestionsError('')
    try {
      const result = await generatePersonalSuggestions(profile, context, journal.slice(0, 3), ideas.slice(0, 5))
      setSuggestions(result)
    } catch {
      setSuggestionsError('Não foi possível gerar sugestões agora. Tente novamente.')
    } finally {
      setLoadingSuggestions(false)
    }
  }

  return (
    <>
      {/* Conteúdo da página — fundo via CSS variable global do tema */}
      <div className="min-h-full px-4 pt-6 pb-4 animate-fade-up">

        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <h1 className="premium-title">Espaço</h1>
            <p className="premium-subtitle">
              Seu lugar para organizar ideias e acompanhar sua evolução.
            </p>
          </div>
          <button
            onClick={() => setShowSetup(true)}
            className="w-9 h-9 rounded-full flex items-center justify-center transition-all"
            style={{ background: C.brandBg }}
          >
            <Settings2 size={16} style={{ color: C.brand }} />
          </button>
        </div>

        {/* Abas: Espaço pessoal e Progresso (lugar único e organizado) */}
        <div className="segmented-control mb-5" data-tour="espaco-tabs">
          {([['espaco', 'Meu espaço'], ['progresso', 'Progresso'], ['biblioteca', 'Biblioteca']] as const).map(([key, label]) => (
            <button key={key} type="button" data-active={tab === key} onClick={() => setTab(key)}>
              {label}
            </button>
          ))}
        </div>

        {tab === 'progresso' && <ProgressoPanel />}

        {/* Biblioteca: vive dentro de Espaço (continua isolada como componente).
            O wrapper neutraliza o padding-top próprio da página (já estamos numa
            tela com header), mantendo todo o comportamento intacto. */}
        {tab === 'biblioteca' && (
          <div className="-mx-4 -mt-1">
            <Biblioteca />
          </div>
        )}

        {tab === 'espaco' && (
        <>
        {/* Banner de setup */}
        {showSetupBanner && (
          <div className="rounded-2xl p-4 mb-5 relative overflow-hidden"
            style={{ background: 'var(--brand-soft)', border: '1px solid var(--brand-border)' }}>
            <div className="flex gap-3 items-start">
              <span className="text-2xl mt-0.5">🌱</span>
              <div className="flex-1">
                <p className="font-bold text-sm mb-0.5" style={{ color: 'var(--text-primary)' }}>
                  Personalize sua experiência
                </p>
                <p className="text-xs leading-relaxed mb-3" style={{ color: 'var(--text-secondary)' }}>
                  Leva 2 minutinhos. Conta um pouco sobre você para a Deby criar conteúdos muito mais autênticos e alinhados com quem você é.
                </p>
                <button
                  onClick={() => setShowSetup(true)}
                  className="px-4 py-2 rounded-xl text-xs font-bold"
                  style={{ background: 'var(--brand)', color: '#fff' }}
                >
                  Configurar agora ✨
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ──────────────────── HUMOR DO DIA ──────────────────── */}
        <section className="mb-5">
          <div
            className="rounded-3xl p-5"
            style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-card)', border: `1px solid ${'var(--border-color)'}` }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>
                💬 Como você está hoje?
              </h2>
              {moodSaved && (
                <button
                  onClick={editMood}
                  className="text-xs font-medium"
                  style={{ color: C.brand }}
                >
                  Editar
                </button>
              )}
            </div>

            {moodSaved ? (
              /* Humor já salvo */
              <div className="flex items-start gap-3">
                <span className="text-3xl" style={{ fontFamily: '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif' }}>
                  {selectedMood}
                </span>
                <div>
                  <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                    {MOODS.find(m => m.emoji === selectedMood)?.label ?? ''}
                  </p>
                  {moodNote && (
                    <p className="text-sm mt-1 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                      "{moodNote}"
                    </p>
                  )}
                </div>
              </div>
            ) : (
              /* Seletor de humor */
              <>
                <div className="grid grid-cols-4 gap-2 mb-4">
                  {MOODS.map(m => (
                    <button
                      key={m.emoji}
                      onClick={() => setSelectedMood(m.emoji)}
                      className="flex flex-col items-center gap-1 py-2.5 rounded-2xl transition-all duration-200"
                      style={{
                        background: selectedMood === m.emoji ? 'var(--brand-soft)' : 'var(--bg-input)',
                        border: selectedMood === m.emoji
                          ? '1.5px solid var(--brand-border)'
                          : '1.5px solid transparent',
                        transform: selectedMood === m.emoji ? 'scale(1.05)' : 'scale(1)',
                      }}
                    >
                      <span
                        className="text-2xl leading-none"
                        style={{ fontFamily: '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif' }}
                      >
                        {m.emoji}
                      </span>
                      <span className="text-[10px] font-medium" style={{ color: 'var(--text-secondary)' }}>
                        {m.label}
                      </span>
                    </button>
                  ))}
                </div>

                <textarea
                  value={moodNote}
                  onChange={e => setMoodNote(e.target.value)}
                  placeholder="O que está passando pela sua cabeça? (opcional)"
                  rows={2}
                  className="w-full rounded-2xl px-4 py-3 text-sm outline-none resize-none mb-3"
                  style={{
                    background: 'var(--bg-input)',
                    border: '1.5px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    fontFamily: 'inherit',
                    lineHeight: '1.6',
                  }}
                  onFocus={e => e.currentTarget.style.borderColor = 'rgba(109,93,246,0.4)'}
                  onBlur={e => e.currentTarget.style.borderColor = 'rgba(109,93,246,0.12)'}
                />

                <button
                  onClick={saveMood}
                  disabled={!selectedMood}
                  className="w-full py-2.5 rounded-2xl text-sm font-bold transition-all duration-200"
                  style={selectedMood ? {
                    background: 'var(--brand)',
                    color: '#fff',
                  } : {
                    background: 'var(--bg-card-bright)',
                    color: 'var(--text-muted)',
                  }}
                >
                  Salvar humor do dia
                </button>
              </>
            )}
          </div>
        </section>

        {/* ──────────────────── DIÁRIO ──────────────────── */}
        <section className="mb-5">
          <div
            className="rounded-3xl overflow-hidden"
            style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-card)', border: `1px solid ${'var(--border-color)'}` }}
          >
            <div className="px-5 pt-5 pb-4">
              <div className="flex items-center justify-between mb-1">
                <h2 className="font-bold text-base flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                  📖 Meu diário
                </h2>
                <button
                  onClick={() => setJournalOpen(o => !o)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                  style={{ background: C.brandBg, color: C.brand }}
                >
                  {journalOpen ? <X size={12} /> : <Plus size={12} />}
                  {journalOpen ? 'Cancelar' : 'Nova história'}
                </button>
              </div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Registre momentos, histórias e reflexões.
              </p>
            </div>

            {/* Form nova entrada */}
            {journalOpen && (
              <div className="px-5 pb-5 space-y-3">
                <div>
                  <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Como você está neste momento?</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {MOODS.slice(0, 6).map(m => (
                      <button
                        key={m.emoji}
                        onClick={() => setJournalMood(m.emoji)}
                        className="w-9 h-9 rounded-xl text-lg flex items-center justify-center transition-all"
                        style={{
                          fontFamily: '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif',
                          background: journalMood === m.emoji ? 'rgba(109,93,246,0.15)' : 'var(--bg-input)',
                          border: journalMood === m.emoji ? '1.5px solid rgba(109,93,246,0.4)' : '1.5px solid transparent',
                          transform: journalMood === m.emoji ? 'scale(1.12)' : 'scale(1)',
                        }}
                      >
                        {m.emoji}
                      </button>
                    ))}
                  </div>
                </div>

                <textarea
                  value={journalText}
                  onChange={e => setJournalText(e.target.value)}
                  placeholder="O que está acontecendo? Pode ser qualquer coisa — uma conquista, uma dificuldade, um pensamento..."
                  rows={5}
                  className="w-full rounded-2xl px-4 py-3 text-sm outline-none resize-none"
                  style={{
                    background: 'var(--bg-input)',
                    border: '1.5px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    fontFamily: 'inherit',
                    lineHeight: '1.7',
                  }}
                  onFocus={e => e.currentTarget.style.borderColor = 'rgba(109,93,246,0.4)'}
                  onBlur={e => e.currentTarget.style.borderColor = 'rgba(109,93,246,0.12)'}
                  autoFocus
                />

                <button
                  onClick={saveJournalEntry}
                  disabled={!journalText.trim()}
                  className="w-full py-2.5 rounded-2xl text-sm font-bold transition-all"
                  style={journalText.trim() ? {
                    background: 'var(--brand)',
                    color: '#fff',
                  } : {
                    background: 'var(--bg-card-bright)',
                    color: 'var(--text-muted)',
                  }}
                >
                  Salvar no diário ✨
                </button>
              </div>
            )}

            {/* Lista de entradas */}
            {journal.length === 0 && !journalOpen ? (
              <div className="px-5 pb-5">
                <div
                  className="rounded-2xl p-4 text-center"
                  style={{ background: 'var(--bg-card-bright)' }}
                >
                  <p className="text-2xl mb-2">📝</p>
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    Nenhuma história ainda. Comece registrando o seu dia.
                  </p>
                </div>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: 'var(--divider)' }}>
                {journal.map(entry => (
                  <div key={entry.id} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5 flex-1 min-w-0">
                        <span
                          className="text-xl mt-0.5 shrink-0"
                          style={{ fontFamily: '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif' }}
                        >
                          {entry.mood}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs mb-1 font-medium" style={{ color: 'var(--text-muted)' }}>
                            {formatDate(entry.date)}
                          </p>
                          <p
                            className="text-sm leading-relaxed"
                            style={{
                              color: 'var(--text-primary)',
                              display: '-webkit-box',
                              WebkitLineClamp: expandedEntry === entry.id ? 'unset' : 3,
                              WebkitBoxOrient: 'vertical',
                              overflow: expandedEntry === entry.id ? 'visible' : 'hidden',
                            }}
                          >
                            {entry.content}
                          </p>
                          {entry.content.length > 120 && (
                            <button
                              onClick={() => setExpandedEntry(expandedEntry === entry.id ? null : entry.id)}
                              className="flex items-center gap-0.5 mt-1 text-xs font-medium"
                              style={{ color: C.brand }}
                            >
                              {expandedEntry === entry.id
                                ? <><ChevronUp size={12} /> Ver menos</>
                                : <><ChevronDown size={12} /> Ver mais</>
                              }
                            </button>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => deleteJournalEntry(entry.id)}
                        className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ──────────────────── CADERNO DE IDEIAS ──────────────────── */}
        <section className="mb-5">
          <div
            className="rounded-3xl p-5"
            style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-card)', border: `1px solid ${'var(--border-color)'}` }}
          >
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>
                💡 Caderno de ideias
              </h2>
              <span className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ background: C.brandBg, color: C.brand }}>
                {ideas.length} {ideas.length === 1 ? 'ideia' : 'ideias'}
              </span>
            </div>
            <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
              Anote qualquer faísca — um tema, uma história, uma observação.
            </p>

            {/* Input */}
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={ideaText}
                onChange={e => setIdeaText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveIdea()}
                placeholder="Nova ideia..."
                className="flex-1 rounded-2xl px-4 py-2.5 text-sm outline-none transition-all"
                style={{
                  background: 'var(--bg-input)',
                  border: '1.5px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  fontFamily: 'inherit',
                }}
                onFocus={e => e.currentTarget.style.borderColor = 'rgba(109,93,246,0.4)'}
                onBlur={e => e.currentTarget.style.borderColor = 'rgba(109,93,246,0.12)'}
              />
              <button
                onClick={saveIdea}
                disabled={!ideaText.trim()}
                className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 transition-all"
                style={ideaText.trim() ? {
                  background: 'var(--brand)',
                  color: '#fff',
                } : {
                  background: 'var(--bg-card-bright)',
                  color: 'var(--text-muted)',
                }}
              >
                <Plus size={18} />
              </button>
            </div>

            {/* Category selector */}
            <div className="flex gap-2 mb-4">
              {IDEA_CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setIdeaCategory(cat)}
                  className="px-3 py-1 rounded-full text-xs font-semibold transition-all"
                  style={ideaCategory === cat ? {
                    background: CATEGORY_COLORS[cat].bg,
                    color: CATEGORY_COLORS[cat].text,
                    border: `1.5px solid ${CATEGORY_COLORS[cat].text}30`,
                  } : {
                    background: 'var(--bg-input)',
                    color: 'var(--text-muted)',
                    border: '1.5px solid var(--border-color)',
                  }}
                >
                  {cat === 'conteúdo' ? '📱 ' : cat === 'pessoal' ? '💚 ' : '✨ '}
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </button>
              ))}
            </div>

            {/* Lista de ideias */}
            {ideas.length === 0 ? (
              <div
                className="rounded-2xl p-4 text-center"
                style={{ background: 'var(--bg-card-bright)' }}
              >
                <p className="text-xl mb-2">💭</p>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  Nenhuma ideia anotada ainda. Anote qualquer coisa!
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {ideas.map(idea => (
                  <div
                    key={idea.id}
                    className="flex items-start gap-2.5 px-3.5 py-3 rounded-2xl"
                    style={{ background: 'var(--bg-input)' }}
                  >
                    <span
                      className="text-sm mt-0.5 shrink-0"
                      style={{ fontFamily: '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif' }}
                    >
                      {idea.category === 'conteúdo' ? '📱' : idea.category === 'pessoal' ? '💚' : '✨'}
                    </span>
                    <p className="flex-1 text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                      {idea.content}
                    </p>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: CATEGORY_COLORS[idea.category].bg, color: CATEGORY_COLORS[idea.category].text }}
                      >
                        {idea.category}
                      </span>
                      <button
                        onClick={() => deletePersonalIdea(idea.id)}
                        style={{ color: 'var(--text-muted)' }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ──────────────────── SUGESTÕES DA IA ──────────────────── */}
        <section className="mb-6">
          <div
            className="rounded-3xl p-5"
            style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-card)', border: `1px solid ${'var(--border-color)'}` }}
          >
            <div className="flex items-center gap-2 mb-1">
              <div
                className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'var(--brand-soft)', border: '1px solid var(--brand-border)' }}
              >
                <Sparkles size={14} style={{ color: C.brand }} />
              </div>
              <h2 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>
                Sugestões para você
              </h2>
            </div>
            <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
              A Deby combina o que você é como pessoa com o que você faz profissionalmente.
            </p>

            {!profile ? (
              <div className="rounded-2xl p-4 text-center" style={{ background: 'var(--bg-card-bright)' }}>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  Complete seu perfil profissional para receber sugestões.
                </p>
              </div>
            ) : suggestions.length > 0 ? (
              <>
                <div className="space-y-2.5 mb-4">
                  {suggestions.map((s, i) => (
                    <div
                      key={i}
                      className="flex gap-3 px-4 py-3 rounded-2xl"
                      style={{ background: 'var(--brand-soft)', border: '1px solid var(--brand-border)' }}
                    >
                      <span
                        className="text-lg shrink-0 mt-0.5"
                        style={{ fontFamily: '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif' }}
                      >
                        {i === 0 ? '✨' : i === 1 ? '💡' : '🎯'}
                      </span>
                      <p className="text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                        {s}
                      </p>
                    </div>
                  ))}
                </div>
                <button
                  onClick={loadSuggestions}
                  disabled={loadingSuggestions}
                  className="w-full py-2.5 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 transition-all"
                  style={{ background: C.brandBg, color: C.brand }}
                >
                  {loadingSuggestions ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  Gerar novas sugestões
                </button>
              </>
            ) : (
              <>
                {suggestionsError && (
                  <p className="text-xs text-center mb-3" style={{ color: '#FF7A6B' }}>
                    {suggestionsError}
                  </p>
                )}
                <div
                  className="rounded-2xl p-4 mb-4"
                  style={{ background: 'var(--brand-soft)', border: '1px solid var(--brand-border)' }}
                >
                  <p className="text-xs leading-relaxed text-center" style={{ color: 'var(--text-secondary)' }}>
                    {hasSetup
                      ? `A Deby vai criar sugestões baseadas no seu momento de vida, seus hobbies e valores — tudo conectado à sua identidade como ${profile.specialty}.`
                      : 'Configure seu espaço pessoal para sugestões ainda mais precisas e autênticas. Ou clique abaixo para sugestões básicas.'}
                  </p>
                </div>
                <button
                  onClick={loadSuggestions}
                  disabled={loadingSuggestions}
                  className="w-full py-3 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition-all"
                  style={{
                    background: loadingSuggestions
                      ? 'var(--bg-card-bright)'
                      : 'var(--brand)',
                    color: loadingSuggestions ? C.brand : '#fff',
                  }}
                >
                  {loadingSuggestions
                    ? <><Loader2 size={14} className="animate-spin" /> Gerando...</>
                    : <><Sparkles size={14} /> Gerar sugestões personalizadas</>
                  }
                </button>
              </>
            )}
          </div>
        </section>
        </>
        )}

      </div>

      {/* Modal de setup */}
      {showSetup && (
        <PersonalSetupModal onClose={() => setShowSetup(false)} />
      )}
    </>
  )
}
