import { useState } from 'react'
import {
  Clock, Check, Bookmark, RefreshCw, Camera, FileText, Copy, Pencil,
  Images, Image, ChevronRight, PenLine
} from 'lucide-react'
import type { ContentIdea } from '../types'
import {
  splitSequenceStories,
  stripStoryHeader,
  extractScreenText,
  extractPhotoDirection
} from '../lib/stories'

const VARIATION_OPTIONS = [
  { label: 'Mais simples', hint: 'mais simples e rápido de executar' },
  { label: 'Mais vendedor', hint: 'com foco em venda e CTA direto' },
  { label: 'Com humor', hint: 'com leveza e humor natural' },
  { label: 'Sem aparecer', hint: 'sem precisar aparecer no vídeo' },
  { label: 'Mais técnico', hint: 'com explicações mais técnicas e detalhadas' },
]

function CopyScreenTextButton({ text, label = 'Copiar texto' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
      className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full transition-all duration-200 active:scale-95"
      style={copied
        ? { background: 'rgba(83,214,161,0.15)', color: '#53D6A1', border: '1px solid rgba(83,214,161,0.3)' }
        : { background: 'var(--brand)', color: '#fff' }}>
      {copied ? <><Check size={12} /> Copiado</> : <><Copy size={12} /> {label}</>}
    </button>
  )
}

export interface ScriptCardProps {
  idea: ContentIdea
  onUpdate: (updated: ContentIdea) => void
  onSave: () => void
  onRecord: (override?: ContentIdea) => void
  onCaption: () => void
  onVariation: (hint: string) => void
  onDone?: () => void             // Opcional: se fornecido, ativa o botão "Fiz" e comemoração (Home)
  onCopy?: () => void             // Opcional: se fornecido, ativa o botão de copiar roteiro (Criar)
  featured?: boolean              // Destaque visual (faixa roxa e sombra mais forte)
  busy?: boolean                  // Bloqueia as ações se estiver gerando variação (Criar)
}

export default function ScriptCard({
  idea,
  onUpdate,
  onSave,
  onRecord,
  onCaption,
  onVariation,
  onDone,
  onCopy,
  featured = false,
  busy = false,
}: ScriptCardProps) {
  const [expanded, setExpanded] = useState(featured)
  const [showVariations, setShowVariations] = useState(false)
  const [celebrating, setCelebrating] = useState(false)
  const [copied, setCopied] = useState(false)

  // Edição manual do roteiro (falas + parte visual)
  const [editing, setEditing] = useState(false)
  const [draftContent, setDraftContent] = useState(idea.content)

  const startEdit = () => {
    setDraftContent(idea.content)
    setExpanded(true)
    setEditing(true)
  }

  const cancelEdit = () => {
    setEditing(false)
    setDraftContent(idea.content)
  }

  const saveEdit = () => {
    const next = draftContent.trim()
    if (next && next !== idea.content) {
      onUpdate({ ...idea, content: next })
    }
    setEditing(false)
  }

  const isPhoto = idea.media === 'photo'
  const stories = idea.type === 'sequence' ? splitSequenceStories(idea.content) : []
  const isMultiStory = stories.length > 1

  const handleDone = () => {
    if (onDone) {
      setCelebrating(true)
      setTimeout(() => {
        setCelebrating(false)
        onDone()
      }, 1200)
    }
  }

  const handleCopy = () => {
    const text = isPhoto
      ? (isMultiStory
          ? stories.map((s, i) => `Foto ${i + 1}:\n${extractScreenText(s)}`).join('\n\n')
          : extractScreenText(idea.content))
      : idea.content + (idea.cta ? `\n\nCTA: ${idea.cta}` : '')
    
    navigator.clipboard.writeText(text)
    setCopied(true)
    if (onCopy) onCopy()
    setTimeout(() => setCopied(false), 2000)
  }

  const TYPE_META: Record<string, { label: string }> = {
    story: { label: 'Story' },
    sequence: { label: 'Sequência' },
    reel: { label: 'Reels' },
  }
  const meta = TYPE_META[idea.type] ?? { label: idea.type }

  return (
    <div
      className="relative overflow-hidden rounded-2xl transition-all duration-300"
      style={{
        background: 'var(--bg-elevated)',
        border: featured ? '1px solid var(--brand-border)' : '1px solid var(--border-subtle)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      {/* Faixa decorativa no topo para cartões destacados */}
      {featured && (
        <div className="absolute top-0 left-0 right-0 h-1" style={{ background: 'var(--brand)' }} />
      )}

      {/* Comemoração de pontos (Fiz) */}
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
        
        {/* Cabeçalho do Card */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1">
            <div className="flex flex-wrap gap-1.5 mb-2">
              <span className="tag tag-purple uppercase">{meta.label}</span>
              {isPhoto && (
                <span className="tag tag-purple flex items-center gap-1">
                  {idea.type === 'sequence' ? <Images size={11} /> : <Image size={11} />} Foto
                </span>
              )}
              <span className="tag tag-amber flex items-center gap-1">
                <Clock size={9} /> {idea.timeEstimate || 'Rápido'}
              </span>
              {idea.status === 'done' && <span className="tag tag-mint flex items-center gap-1"><Check size={9} /> Feito</span>}
              {idea.status === 'saved' && (
                <span className="tag" style={{ background: 'rgba(109,93,246,0.15)', border: '1px solid rgba(109,93,246,0.3)', color: '#9B8CFF' }}>
                  Salvo
                </span>
              )}
            </div>
            <h3 className="font-extrabold text-base leading-snug" style={{ color: 'var(--text-primary)' }}>{idea.theme}</h3>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{idea.objective}</p>
          </div>
        </div>

        {/* Corpo Expandido (Roteiro e Edição) */}
        {expanded && (
          <div className="mt-4 space-y-3">
            {editing ? (
              // Modo de edição
              <div className="space-y-2">
                <textarea
                  className="input w-full text-sm leading-relaxed"
                  style={{ minHeight: 240, whiteSpace: 'pre-wrap' }}
                  value={draftContent}
                  onChange={e => setDraftContent(e.target.value)}
                  placeholder="Edite o roteiro do seu jeito..."
                  autoFocus
                />
                <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  Dica: linhas com <strong>FALA:</strong> vão para o teleprompter. 
                  <strong> CENA:</strong>, <strong>TEXTO NA TELA:</strong> são indicações visuais.
                </p>
                <div className="flex gap-2">
                  <button onClick={cancelEdit} className="btn-secondary flex-1 py-2 text-sm">Cancelar</button>
                  <button onClick={saveEdit} className="btn-primary flex-1 py-2 text-sm"><Check size={14} /> Salvar</button>
                </div>
              </div>
            ) : isMultiStory ? (
              // Roteiro com múltiplos blocos (sequência)
              <>
                <p className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                  {isPhoto
                    ? `Sequência de ${stories.length} fotos. Poste na ordem:`
                    : `Sequência de ${stories.length} stories. Grave 1 a 1:`}
                </p>
                {stories.map((story, i) => {
                  const body = stripStoryHeader(story)
                  const storyIdea: ContentIdea = {
                    ...idea,
                    id: `${idea.id}-s${i + 1}`,
                    type: 'story',
                    theme: `Story ${i + 1} — ${idea.theme}`,
                    content: body,
                    cta: i === stories.length - 1 ? idea.cta : '',
                  }
                  const screenText = extractScreenText(story)

                  return (
                    <div key={i} className="rounded-2xl p-4"
                      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="tag tag-purple text-[10px]">
                          {isPhoto ? 'Foto' : 'Story'} {i + 1} de {stories.length}
                        </span>
                        {isPhoto ? (
                          <CopyScreenTextButton text={screenText} />
                        ) : (
                          idea.status !== 'done' && (
                            <button onClick={() => onRecord(storyIdea)}
                              className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full transition-all duration-200 active:scale-95"
                              style={{ background: 'var(--brand)', color: '#fff' }}>
                              <Camera size={12} /> Gravar este
                            </button>
                          )
                        )}
                      </div>
                      
                      {isPhoto ? (
                        <div className="space-y-2">
                          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Texto da tela</p>
                          <pre className="text-xs whitespace-pre-wrap font-sans leading-relaxed rounded-xl p-3"
                            style={{ color: 'var(--text-primary)', background: 'var(--bg-input)', border: '1px solid var(--border-color)' }}>
                            {screenText}
                          </pre>
                          {extractPhotoDirection(story) && (
                            <>
                              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Como fotografar</p>
                              <pre className="text-xs whitespace-pre-wrap font-sans leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                                {extractPhotoDirection(story)}
                              </pre>
                            </>
                          )}
                        </div>
                      ) : (
                        <pre className="text-xs whitespace-pre-wrap font-sans leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                          {body}
                        </pre>
                      )}
                    </div>
                  )
                })}
              </>
            ) : (
              // Roteiro único (story único ou reels)
              <>
                {isPhoto ? (
                  <div className="rounded-2xl p-4 mb-3 space-y-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Texto da tela</p>
                      <CopyScreenTextButton text={extractScreenText(idea.content)} />
                    </div>
                    <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed rounded-xl p-3"
                      style={{ color: 'var(--text-primary)', background: 'var(--bg-input)', border: '1px solid var(--border-color)' }}>
                      {extractScreenText(idea.content)}
                    </pre>
                    {extractPhotoDirection(idea.content) && (
                      <>
                        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Como fotografar</p>
                        <pre className="text-xs whitespace-pre-wrap font-sans leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                          {extractPhotoDirection(idea.content)}
                        </pre>
                      </>
                    )}
                  </div>
                ) : (
                  <button type="button" onClick={startEdit}
                    className="w-full text-left rounded-2xl p-4 transition-all active:scale-[0.99] border"
                    style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
                    title="Toque para editar o roteiro">
                    <pre className="text-xs whitespace-pre-wrap font-sans leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                      {idea.content}
                    </pre>
                    <span className="flex items-center gap-1 mt-2 text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}>
                      <Pencil size={11} /> Toque para editar
                    </span>
                  </button>
                )}
              </>
            )}

            {/* CTA do Roteiro */}
            {idea.cta && !isPhoto && (
              <div className="rounded-2xl p-3" style={{ background: 'rgba(255,122,107,0.08)', border: '1px solid rgba(255,122,107,0.2)' }}>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#FF7A6B' }}>
                  CTA (já incluído na fala)
                </p>
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{idea.cta}</p>
              </div>
            )}
          </div>
        )}

        {/* Links do rodapé do card */}
        <div className="flex items-center justify-between gap-2 mt-3">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs font-bold transition-colors"
            style={{ color: '#9B8CFF' }}
          >
            {expanded ? 'Fechar roteiro' : 'Ver roteiro completo'}
            <ChevronRight size={14} style={{ transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
          </button>
          {!editing && (
            <button onClick={startEdit}
              className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full flex-shrink-0 transition-all duration-200 active:scale-95"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}
              title="Editar roteiro"
            >
              <PenLine size={13} /> Editar
            </button>
          )}
        </div>

        {/* Painel de Ações Principal */}
        {idea.status !== 'done' && (
          <div className="mt-4 pt-4 space-y-2" style={{ borderTop: '1px solid var(--border-color)' }}>
            <div className="flex gap-2">
              
              {/* Botão Fiz / Copiar dependendo do uso */}
              {onDone ? (
                <button onClick={handleDone} className="btn-primary flex-1 py-2 text-sm gap-1.5">
                  <Check size={14} /> Fiz
                </button>
              ) : (
                <button onClick={handleCopy} className="btn-primary flex-1 py-2 text-sm gap-1.5"
                  style={copied ? { background: 'var(--success)' } : {}}>
                  {copied ? <><Check size={14} /> Copiado!</> : <><Copy size={14} /> {isPhoto ? 'Copiar texto' : 'Copiar roteiro'}</>}
                </button>
              )}

              {/* Botão Gravar (se for vídeo único) */}
              {!isMultiStory && !isPhoto && (
                <button
                  onClick={() => onRecord()}
                  className="btn-secondary py-2 px-3.5 text-sm flex items-center justify-center gap-1.5"
                  title="Gravar"
                  aria-label="Gravar"
                >
                  <Camera size={14} />
                  <span className="text-xs hidden sm:inline">Gravar</span>
                </button>
              )}

              {/* Botão Gravar Sequência 1 a 1 */}
              {isMultiStory && !isPhoto && (
                <button
                  onClick={() => setExpanded(true)}
                  className="btn-secondary py-2 px-3.5 text-sm flex items-center justify-center gap-1.5"
                  title="Gravar 1 a 1"
                  aria-label="Gravar 1 a 1"
                >
                  <Camera size={14} />
                  <span className="text-xs hidden sm:inline">Gravar 1 a 1</span>
                </button>
              )}

              {/* Botão Legenda (Reels) */}
              {idea.type === 'reel' && (
                <button
                  onClick={onCaption}
                  className="btn-secondary py-2 px-3.5 text-sm flex items-center justify-center gap-1.5"
                  title="Legenda"
                  aria-label="Legenda"
                >
                  <FileText size={14} />
                  <span className="text-xs hidden sm:inline">Legenda</span>
                </button>
              )}

              {/* Botão Salvar (Bookmark) */}
              <button
                onClick={onSave}
                className="btn-secondary py-2 px-3.5 text-sm flex items-center justify-center"
                title="Salvar"
                aria-label="Salvar"
                style={idea.status === 'saved' ? { borderColor: 'rgba(83,214,161,0.4)', color: '#53D6A1' } : {}}
              >
                <Bookmark size={14} style={idea.status === 'saved' ? { fill: '#53D6A1' } : {}} />
              </button>

              {/* Botão Variações (Refresh) */}
              <button
                onClick={() => setShowVariations(!showVariations)}
                className="btn-secondary py-2 px-3.5 text-sm flex items-center justify-center"
                title="Variar"
                aria-label="Variar"
                disabled={busy}
              >
                <RefreshCw size={14} className={busy ? 'animate-spin' : ''} />
              </button>
            </div>

            {/* Lista de chips de variação */}
            {showVariations && (
              <div className="flex flex-wrap gap-1.5 pt-1 animate-fade-up">
                {VARIATION_OPTIONS.map(v => (
                  <button
                    key={v.label}
                    onClick={() => {
                      onVariation(v.label.toLowerCase())
                      setShowVariations(false)
                    }}
                    disabled={busy}
                    className="chip chip-inactive text-[10px] py-1 px-2.5 disabled:opacity-40"
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
