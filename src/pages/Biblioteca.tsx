import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import {
  getLibraryItems,
  toggleFavorite,
  deleteLibraryItem,
  duplicateLibraryItem,
  updateLibraryItem,
  createLibraryItemsBatch,
} from '../services/libraryService'
import { generateLibraryItems } from '../lib/ai'
import { splitSequenceStories, stripStoryHeader } from '../lib/stories'
import { getBrandEssence } from '../services/essenceService'
import { addCalendarItem, toISODateKey } from '../services/userJourneyService'
import type { LibraryItem, LibraryItemType } from '../lib/supabase/types'
import type { ContentIdea } from '../types'
import StudioModal from '../components/StudioModal'
import {
  Bookmark, Check, Filter, Search, Copy, ChevronRight,
  Star, Trash2, Edit3, RefreshCw, Sparkles, Lock, X, Camera, CalendarPlus, AlertCircle
} from 'lucide-react'

type LibraryEdits = Partial<Pick<LibraryItem, 'title' | 'content' | 'category' | 'tags'>>

// Converte um item da biblioteca no formato que o teleprompter (StudioModal) espera.
function libraryItemToIdea(item: LibraryItem): ContentIdea {
  const typeMap: Record<string, ContentIdea['type']> = {
    reels_script: 'reel',
    story_sequence: 'sequence',
  }
  return {
    id: item.id,
    type: typeMap[item.type] ?? 'story',
    theme: item.title,
    objective: item.category ?? '',
    content: item.content,
    cta: '',
    timeEstimate: '',
    exposureLevel: 'comfortable-talking',
    status: 'saved',
    favorite: item.is_favorite,
    createdAt: item.created_at,
    tags: item.tags ?? [],
  }
}

// ─── Metadados visuais por tipo ───────────────────────────

const TYPE_META: Record<string, { label: string; icon: string; color: string; section: string }> = {
  story_sequence:  { label: 'Sequência de stories', icon: '🎞️', color: 'tag-amber', section: 'Ideias de Stories' },
  reels_script:    { label: 'Roteiro de reels', icon: '🎬', color: 'tag-coral', section: 'Roteiros Curtos' },
  caption:         { label: 'Legenda', icon: '✍️', color: 'tag-purple', section: 'Legendas' },
  hook:            { label: 'Gancho', icon: '🎣', color: 'tag-mint', section: 'Ganchos' },
  cta:             { label: 'CTA', icon: '📣', color: 'tag-coral', section: 'CTAs' },
  content_idea:    { label: 'Ideia de conteúdo', icon: '💡', color: 'tag-purple', section: 'Para postar hoje' },
  objection_answer:{ label: 'Resposta a objeção', icon: '💬', color: 'tag-mint', section: 'Dúvidas do público' },
  routine_prompt:  { label: 'Prompt de rotina', icon: '⚡', color: 'tag-amber', section: 'Rotina de gravação' },
  daily_prompt:    { label: 'Prompt diário', icon: '📅', color: 'tag-amber', section: 'Rotina de gravação' },
  carousel_idea:   { label: 'Carrossel', icon: '🗂️', color: 'tag-purple', section: 'Carrosséis' },
  static_post_idea:{ label: 'Post estático', icon: '🖼️', color: 'tag-mint', section: 'Posts Estáticos' },
}

// ─── Componente de item ────────────────────────────────────

interface ItemCardProps {
  item: LibraryItem
  onFavorite: () => void
  onDelete: () => void
  onDuplicate: () => void
  onEdit: (updates: LibraryEdits) => void
  // Aceita override: para gravar UM story de uma sequência, passamos a ideia
  // derivada (só aquele story). Sem override, grava o item inteiro.
  onRecord: (override?: ContentIdea) => void
  onAddToCalendar: () => void
}

function ItemCard({ item, onFavorite, onDelete, onDuplicate, onEdit, onRecord, onAddToCalendar }: ItemCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState(item.content)
  const [editTitle, setEditTitle] = useState(item.title)
  const [editCategory, setEditCategory] = useState(item.category ?? '')
  const [editTags, setEditTags] = useState((item.tags ?? []).join(', '))
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const meta = TYPE_META[item.type] ?? { label: item.type, icon: '📝', color: 'tag-purple', section: '' }

  // Sequência → stories individuais, para ler e gravar 1 a 1.
  const stories = item.type === 'story_sequence' ? splitSequenceStories(item.content) : []
  const isMultiStory = stories.length > 1

  const handleCopy = () => {
    navigator.clipboard.writeText(item.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const startEdit = () => {
    setEditTitle(item.title)
    setEditContent(item.content)
    setEditCategory(item.category ?? '')
    setEditTags((item.tags ?? []).join(', '))
    setEditing(true)
  }

  const handleSaveEdit = () => {
    onEdit({
      title: editTitle.trim() || item.title,
      content: editContent,
      category: editCategory.trim() || null,
      tags: editTags.split(',').map(t => t.trim()).filter(Boolean),
    })
    setEditing(false)
  }

  return (
    <div
      className="rounded-2xl overflow-hidden transition-all duration-300"
      style={{
        background: item.is_favorite ? 'rgba(109,93,246,0.08)' : 'rgba(255,255,255,0.04)',
        border: item.is_favorite ? '1px solid rgba(109,93,246,0.25)' : '1px solid var(--border-color)',
      }}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap gap-1.5 mb-2">
              <span className={`tag ${meta.color}`}>{meta.icon} {meta.label}</span>
              {item.is_favorite && (
                <span className="tag" style={{ background: 'rgba(247,185,85,0.15)', border: '1px solid rgba(247,185,85,0.3)', color: '#F7B955' }}>
                  ⭐ Favorito
                </span>
              )}
              {(item.tags ?? []).slice(0, 2).map(tag => (
                <span key={tag} className="tag tag-amber">{tag}</span>
              ))}
            </div>
            <h3 className="font-extrabold text-sm leading-snug" style={{ color: 'var(--text-primary)' }}>{item.title}</h3>
            {item.category && (
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{item.category}</p>
            )}
          </div>
          <button onClick={onFavorite} className="flex-shrink-0 transition-all duration-200 mt-0.5">
            <Star
              size={18}
              style={item.is_favorite ? { color: '#F7B955', fill: '#F7B955' } : { color: 'var(--text-muted)' }}
            />
          </button>
        </div>

        {expanded && !editing && (
          <div className="mt-3 animate-fade-up">
            {isMultiStory ? (
              <div className="space-y-2.5">
                <p className="text-[11px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
                  Sequência de {stories.length} stories. Grave um de cada vez:
                </p>
                {stories.map((story, i) => {
                  const body = stripStoryHeader(story)
                  // Ideia derivada SÓ deste story → vai sozinha para o teleprompter.
                  const storyIdea: ContentIdea = {
                    ...libraryItemToIdea(item),
                    id: `${item.id}-s${i + 1}`,
                    type: 'story',
                    theme: `Story ${i + 1} — ${item.title}`,
                    content: body,
                  }
                  return (
                    <div key={i} className="rounded-xl p-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="tag tag-purple text-[10px]">Story {i + 1} de {stories.length}</span>
                        <button onClick={() => onRecord(storyIdea)}
                          className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full"
                          style={{ background: 'linear-gradient(135deg, #6D5DF6, #9B8CFF)', color: '#fff' }}>
                          <Camera size={11} /> Gravar este
                        </button>
                      </div>
                      <pre className="text-xs whitespace-pre-wrap font-sans leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                        {body}
                      </pre>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="rounded-xl p-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                <pre className="text-xs whitespace-pre-wrap font-sans leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                  {item.content}
                </pre>
              </div>
            )}
          </div>
        )}

        {editing && (
          <div className="mt-3 animate-fade-up space-y-2">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Título</label>
              <input className="input text-xs" value={editTitle} onChange={e => setEditTitle(e.target.value)} placeholder="Título" />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Categoria</label>
              <input className="input text-xs" value={editCategory} onChange={e => setEditCategory(e.target.value)} placeholder="Categoria (opcional)" />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Tags (separadas por vírgula)</label>
              <input className="input text-xs" value={editTags} onChange={e => setEditTags(e.target.value)} placeholder="ex.: venda, bastidor" />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Conteúdo</label>
              <textarea
                className="input resize-none w-full text-xs"
                rows={6}
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <button onClick={handleSaveEdit}
                className="flex-1 py-2 rounded-xl text-xs font-bold"
                style={{ background: 'linear-gradient(135deg, #6D5DF6, #9B8CFF)', color: 'white' }}>
                Salvar
              </button>
              <button onClick={() => setEditing(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-bright)', color: 'var(--text-secondary)' }}>
                <X size={14} />
              </button>
            </div>
          </div>
        )}

        {confirmingDelete && (
          <div className="mt-3 rounded-xl p-3 flex items-center gap-2 animate-fade-up"
            style={{ background: 'rgba(255,122,107,0.08)', border: '1px solid rgba(255,122,107,0.25)' }}>
            <AlertCircle size={15} style={{ color: '#FF7A6B', flexShrink: 0 }} />
            <p className="text-xs flex-1" style={{ color: 'var(--text-primary)' }}>Excluir este item?</p>
            <button onClick={() => setConfirmingDelete(false)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold" style={{ background: 'var(--bg-card-bright)', color: 'var(--text-secondary)' }}>
              Não
            </button>
            <button onClick={() => { setConfirmingDelete(false); onDelete() }}
              className="px-3 py-1.5 rounded-lg text-xs font-bold text-white" style={{ background: 'linear-gradient(135deg,#FF7A6B,#E85D4E)' }}>
              Excluir
            </button>
          </div>
        )}

        <div className="flex items-center gap-2 mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <button onClick={() => { setExpanded(!expanded); setEditing(false) }}
            className="flex items-center gap-1 text-xs font-bold flex-1 transition-colors"
            style={{ color: '#9B8CFF' }}>
            {expanded ? 'Fechar' : 'Ver conteúdo'}
            <ChevronRight size={12} style={{ transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
          </button>

          <div className="flex items-center gap-1.5">
            {expanded && (
              <>
                <button onClick={handleCopy}
                  className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-xl transition-all"
                  style={copied ? {
                    background: 'rgba(83,214,161,0.15)', color: '#53D6A1', border: '1px solid rgba(83,214,161,0.3)',
                  } : {
                    background: 'var(--bg-card-bright)', color: 'var(--text-secondary)', border: '1px solid var(--border-bright)',
                  }}>
                  {copied ? <Check size={11} /> : <Copy size={11} />}
                </button>
                <button onClick={() => (editing ? setEditing(false) : startEdit())}
                  className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-xl"
                  style={{ background: 'var(--bg-card-bright)', color: 'var(--text-secondary)', border: '1px solid var(--border-bright)' }}
                  title="Editar">
                  <Edit3 size={11} />
                </button>
              </>
            )}
            {/* Sequência: cada story tem seu "Gravar este" acima. O botão único só
                aparece para conteúdo de gravação única (story/reels/etc.). */}
            {!isMultiStory && (
              <button onClick={() => onRecord()}
                className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-xl"
                style={{ background: 'rgba(124,92,255,0.12)', color: '#9B8CFF', border: '1px solid rgba(124,92,255,0.3)' }}
                title="Gravar com teleprompter" aria-label="Gravar com teleprompter">
                <Camera size={11} />
              </button>
            )}
            <button onClick={onAddToCalendar}
              className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-xl"
              style={{ background: 'rgba(83,214,161,0.1)', color: '#53D6A1', border: '1px solid rgba(83,214,161,0.25)' }}
              title="Adicionar ao calendário (hoje)" aria-label="Adicionar ao calendário">
              <CalendarPlus size={11} />
            </button>
            <button onClick={onDuplicate}
              className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-xl"
              style={{ background: 'var(--bg-card-bright)', color: 'var(--text-secondary)', border: '1px solid var(--border-bright)' }}
              title="Duplicar">
              <RefreshCw size={11} />
            </button>
            <button onClick={() => setConfirmingDelete(true)}
              className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-xl"
              style={{ background: 'rgba(255,122,107,0.08)', color: '#FF7A6B', border: '1px solid rgba(255,122,107,0.2)' }}
              title="Excluir">
              <Trash2 size={11} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Estado de bloqueio (sem essência) ────────────────────

function EssenciaRequired() {
  const navigate = useNavigate()
  return (
    <div className="flex flex-col items-center justify-center text-center p-10 gap-6 min-h-[60vh]">
      <div className="w-20 h-20 rounded-3xl flex items-center justify-center"
        style={{ background: 'rgba(109,93,246,0.1)', border: '2px solid rgba(109,93,246,0.2)' }}>
        <Lock size={32} style={{ color: '#9B8CFF' }} />
      </div>
      <div>
        <h2 className="text-2xl font-extrabold mb-3" style={{ color: 'var(--text-primary)' }}>
          Sua biblioteca ainda não foi destravada.
        </h2>
        <p className="text-sm leading-relaxed max-w-xs mx-auto" style={{ color: 'var(--text-secondary)' }}>
          Para receber ideias personalizadas, primeiro precisamos entender sua essência: seu tom, sua rotina, seus assuntos, seu público e o que faz sentido para você postar.
        </p>
      </div>
      <button
        onClick={() => navigate('/essencia')}
        className="btn-primary px-8"
      >
        <Sparkles size={16} />
        Preencher Minha Essência
      </button>
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────

type ActiveFilter = 'all' | LibraryItemType
type SectionKey = string

export default function Biblioteca() {
  const { state } = useApp()
  const [items, setItems] = useState<LibraryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [hasEssence, setHasEssence] = useState<boolean | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<ActiveFilter>('all')
  const [showFavOnly, setShowFavOnly] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  // Ideia enviada ao teleprompter. Para sequência, é UM story específico; senão,
  // é o item inteiro convertido em ideia.
  const [studioIdea, setStudioIdea] = useState<ContentIdea | null>(null)
  // Evita rodar a geração inicial duas vezes (StrictMode / re-render).
  const didInitRef = useRef(false)

  const loadItems = useCallback(async (reset = false, pageOverride?: number) => {
    try {
      // pageOverride evita o bug de usar a página antiga do closure após setPage
      // (setPage é assíncrono). "Carregar mais" passa a próxima página explicitamente.
      const currentPage = reset ? 1 : (pageOverride ?? page)
      if (reset) setPage(1)

      const { items: newItems, total: newTotal } = await getLibraryItems({
        type: typeFilter !== 'all' ? typeFilter : undefined,
        isFavorite: showFavOnly || undefined,
        search: search || undefined,
        page: currentPage,
        pageSize: 30,
      })

      setItems(prev => reset ? newItems : [...prev, ...newItems])
      setTotal(newTotal)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar biblioteca.')
    }
  }, [typeFilter, showFavOnly, search, page])

  useEffect(() => {
    const init = async () => {
      // Idempotência: roda só uma vez (evita gerar biblioteca em duplicidade).
      if (didInitRef.current) return
      didInitRef.current = true
      setLoading(true)
      try {
        // Verificar se tem essência
        const essence = state.essence ?? await getBrandEssence()
        if (!essence) {
          setHasEssence(false)
          return
        }
        setHasEssence(true)

        // Tentar carregar itens
        const { items: existingItems, total: existingTotal } = await getLibraryItems({ pageSize: 30 })

        if (existingItems.length === 0) {
          // Gerar biblioteca inicial (IA client-side → salva no banco)
          setGenerating(true)
          try {
            const generated = await generateLibraryItems(essence)
            // Re-checa antes de inserir: outra aba/dispositivo pode ter gerado
            // enquanto a IA respondia. Evita duplicar a biblioteca inteira.
            const recheck = await getLibraryItems({ pageSize: 30 })
            if (recheck.items.length > 0) {
              setItems(recheck.items)
              setTotal(recheck.total)
              return
            }
            const saved = await createLibraryItemsBatch(
              generated.map(g => ({
                essence_id: essence.id,
                type: g.type,
                title: g.title,
                content: g.content,
                category: g.category || null,
                format: null,
                status: 'saved' as const,
                source: 'ai' as const,
                tags: g.tags,
                metadata: null,
                is_favorite: false,
              }))
            )
            setItems(saved)
            setTotal(saved.length)
          } catch (genErr) {
            setError(genErr instanceof Error ? genErr.message : 'Erro ao gerar biblioteca.')
          } finally {
            setGenerating(false)
          }
        } else {
          setItems(existingItems)
          setTotal(existingTotal)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar.')
      } finally {
        setLoading(false)
      }
    }

    init()
  }, [])

  // Recarregar quando filtros mudam
  useEffect(() => {
    if (hasEssence && !loading) {
      loadItems(true)
    }
  }, [typeFilter, showFavOnly, search])

  const handleFavorite = async (item: LibraryItem) => {
    try {
      await toggleFavorite(item.id, item.is_favorite)
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_favorite: !i.is_favorite } : i))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao favoritar.')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteLibraryItem(id)
      setItems(prev => prev.filter(i => i.id !== id))
      setTotal(t => t - 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir.')
    }
  }

  const handleAddToCalendar = async (item: LibraryItem) => {
    try {
      await addCalendarItem(toISODateKey(), libraryItemToIdea(item))
      setError('')
      setNotice('Adicionado ao calendário de hoje.')
      setTimeout(() => setNotice(''), 2500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao adicionar ao calendário.')
    }
  }

  const handleDuplicate = async (id: string) => {
    try {
      const dup = await duplicateLibraryItem(id)
      setItems(prev => [dup, ...prev])
      setTotal(t => t + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao duplicar.')
    }
  }

  const handleEdit = async (id: string, updates: LibraryEdits) => {
    try {
      const updated = await updateLibraryItem(id, updates)
      setItems(prev => prev.map(i => i.id === id ? updated : i))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao editar.')
    }
  }

  // Agrupar por seção
  const grouped = items.reduce<Record<SectionKey, LibraryItem[]>>((acc, item) => {
    const section = TYPE_META[item.type]?.section ?? 'Outros'
    if (!acc[section]) acc[section] = []
    acc[section].push(item)
    return acc
  }, {})

  const SECTION_ORDER = [
    'Para postar hoje', 'Ideias de Stories', 'Roteiros Curtos', 'Ganchos',
    'CTAs', 'Dúvidas do público', 'Rotina de gravação', 'Carrosséis', 'Posts Estáticos', 'Legendas', 'Outros',
  ]

  const sortedSections = Object.keys(grouped).sort(
    (a, b) => SECTION_ORDER.indexOf(a) - SECTION_ORDER.indexOf(b)
  )

  // ─── Renders ────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-10">
        <span className="w-10 h-10 rounded-full animate-spin"
          style={{ border: '2px solid rgba(109,93,246,0.3)', borderTopColor: '#9B8CFF' }} />
        <p className="text-sm font-medium text-center" style={{ color: 'var(--text-muted)' }}>
          Carregando sua biblioteca...
        </p>
      </div>
    )
  }

  if (hasEssence === false) return <EssenciaRequired />

  if (generating) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 p-10 text-center">
        <div className="w-20 h-20 rounded-3xl flex items-center justify-center"
          style={{ background: 'rgba(109,93,246,0.1)', border: '2px solid rgba(109,93,246,0.2)' }}>
          <Sparkles size={32} style={{ color: '#9B8CFF' }} className="animate-pulse" />
        </div>
        <div>
          <h2 className="text-xl font-extrabold mb-2" style={{ color: 'var(--text-primary)' }}>
            Organizando sua biblioteca personalizada...
          </h2>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Costuma levar ~10–15s e só precisa acontecer uma vez.
          </p>
        </div>
        <span className="w-8 h-8 rounded-full animate-spin"
          style={{ border: '2px solid rgba(109,93,246,0.3)', borderTopColor: '#9B8CFF' }} />
      </div>
    )
  }

  const FILTER_TYPES: { value: ActiveFilter; label: string }[] = [
    { value: 'all', label: 'Todos' },
    { value: 'content_idea', label: '💡 Ideias' },
    { value: 'story_sequence', label: '🎞️ Stories' },
    { value: 'reels_script', label: '🎬 Reels' },
    { value: 'hook', label: '🎣 Ganchos' },
    { value: 'cta', label: '📣 CTAs' },
    { value: 'objection_answer', label: '💬 Objeções' },
    { value: 'routine_prompt', label: '⚡ Rotina' },
  ]

  return (
    <div className="p-5 space-y-5 pb-28">
      <div className="pt-4">
        <h1 className="text-3xl font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>Biblioteca</h1>
        <p className="text-sm mt-1 font-medium" style={{ color: 'var(--text-secondary)' }}>
          {total} {total === 1 ? 'conteúdo salvo' : 'conteúdos salvos'}
        </p>
      </div>

      {error && (
        <div className="rounded-xl px-4 py-3 text-sm font-semibold"
          style={{ background: 'rgba(255,122,107,0.1)', border: '1px solid rgba(255,122,107,0.2)', color: '#FF7A6B' }}>
          {error}
          <button onClick={() => setError('')} className="ml-2 font-bold">×</button>
        </div>
      )}

      {notice && (
        <div className="rounded-xl px-4 py-3 text-sm font-semibold"
          style={{ background: 'rgba(83,214,161,0.1)', border: '1px solid rgba(83,214,161,0.25)', color: '#53D6A1' }}>
          {notice}
        </div>
      )}

      {/* Busca */}
      <div className="relative">
        <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
        <input className="input pl-10" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar na biblioteca..." />
      </div>

      {/* Filtros */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Filter size={12} style={{ color: 'var(--text-muted)' }} />
          <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Filtros</span>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {FILTER_TYPES.map(({ value, label }) => (
            <button key={value} onClick={() => setTypeFilter(value)}
              className={`chip whitespace-nowrap text-xs ${typeFilter === value ? 'chip-active' : 'chip-inactive'}`}>
              {label}
            </button>
          ))}
          <button
            onClick={() => setShowFavOnly(!showFavOnly)}
            className={`chip whitespace-nowrap text-xs flex items-center gap-1 ${showFavOnly ? 'chip-active' : 'chip-inactive'}`}>
            <Star size={10} style={showFavOnly ? { fill: 'white' } : {}} /> Favoritos
          </button>
        </div>
      </div>

      {/* Lista agrupada por seção */}
      {items.length === 0 ? (
        <div className="rounded-3xl p-10 flex flex-col items-center text-center gap-4"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <Bookmark size={32} style={{ color: '#9B8CFF', opacity: 0.5 }} />
          <div>
            <p className="font-extrabold" style={{ color: 'var(--text-primary)' }}>Nenhum resultado</p>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Tente remover os filtros ou busca.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {sortedSections.map(section => (
            <div key={section}>
              <h2 className="text-sm font-extrabold uppercase tracking-widest mb-3"
                style={{ color: 'var(--text-muted)' }}>
                {section}
              </h2>
              <div className="space-y-2.5">
                {grouped[section].map(item => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    onFavorite={() => handleFavorite(item)}
                    onDelete={() => handleDelete(item.id)}
                    onDuplicate={() => handleDuplicate(item.id)}
                    onEdit={(updates) => handleEdit(item.id, updates)}
                    onRecord={(override) => setStudioIdea(override ?? libraryItemToIdea(item))}
                    onAddToCalendar={() => handleAddToCalendar(item)}
                  />
                ))}
              </div>
            </div>
          ))}

          {/* Load more */}
          {items.length < total && (
            <button
              onClick={() => { const next = page + 1; setPage(next); loadItems(false, next) }}
              className="w-full py-3 rounded-2xl text-sm font-bold"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
              Carregar mais ({total - items.length} restantes)
            </button>
          )}
        </div>
      )}

      {studioIdea && (
        <StudioModal idea={studioIdea} onClose={() => setStudioIdea(null)} />
      )}
    </div>
  )
}
