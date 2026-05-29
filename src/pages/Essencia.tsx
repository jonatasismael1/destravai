import { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { getBrandEssence, saveBrandEssence, updateEssenceSummary } from '../services/essenceService'
import { generateEssenceSummary } from '../lib/ai'
import type { BrandEssence } from '../lib/supabase/types'
import { Save, Plus, X, User, MessageSquare, Layout, Briefcase, Shield, Clock, Sparkles, RefreshCw } from 'lucide-react'

type Tab = 'perfil' | 'tom' | 'topicos' | 'servicos' | 'limites' | 'rotina'

const TABS: { value: Tab; label: string; icon: React.ReactNode }[] = [
  { value: 'perfil', label: 'Perfil', icon: <User size={12} /> },
  { value: 'tom', label: 'Tom', icon: <MessageSquare size={12} /> },
  { value: 'topicos', label: 'Tópicos', icon: <Layout size={12} /> },
  { value: 'servicos', label: 'Serviços', icon: <Briefcase size={12} /> },
  { value: 'limites', label: 'Limites', icon: <Shield size={12} /> },
  { value: 'rotina', label: 'Rotina', icon: <Clock size={12} /> },
]

const TONE_OPTIONS = [
  'Didática', 'Direta', 'Elegante', 'Bem-humorada',
  'Acolhedora', 'Técnica', 'Leve', 'Sofisticada', 'Próxima', 'Provocativa',
]

const FORMATS = ['Stories', 'Reels', 'Carrossel', 'Post estático', 'Ao vivo', 'Podcast']
const ROUTINE_OPTIONS = [
  'Antes do trabalho', 'Intervalo', 'Fim do dia', 'Em casa', 'No carro',
  'No trabalho', 'De manhã cedo', 'À noite',
]

function TagInput({ label, values, onChange, placeholder }: {
  label: string; values: string[]; onChange: (v: string[]) => void; placeholder: string
}) {
  const [input, setInput] = useState('')
  const add = () => {
    const v = input.trim()
    if (v && !values.includes(v)) { onChange([...values, v]); setInput('') }
  }
  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex gap-2 mb-2">
        <input className="input flex-1" value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()} placeholder={placeholder} />
        <button onClick={add} className="btn-secondary px-3 py-2"><Plus size={16} /></button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {values.map(v => (
          <span key={v} className="chip chip-active text-xs gap-1">
            {v}
            <button onClick={() => onChange(values.filter(x => x !== v))}><X size={10} /></button>
          </span>
        ))}
      </div>
    </div>
  )
}

type FormState = {
  profession: string
  niche: string
  audience: string
  tone_of_voice: string[]
  content_goals: string
  routine: string
  preferred_formats: string[]
  topics: string[]
  restrictions: string[]
  differentials: string
  services: string[]
  frequent_questions: string[]
  common_objections: string[]
  phrases: string[]
  references_text: string
}

function initForm(essence: BrandEssence | null): FormState {
  return {
    profession: essence?.profession ?? '',
    niche: essence?.niche ?? '',
    audience: essence?.audience ?? '',
    tone_of_voice: essence?.tone_of_voice ? essence.tone_of_voice.split(',').map(s => s.trim()).filter(Boolean) : [],
    content_goals: essence?.content_goals ?? '',
    routine: essence?.routine ?? '',
    preferred_formats: essence?.preferred_formats ?? [],
    topics: essence?.topics ?? [],
    restrictions: essence?.restrictions ?? [],
    differentials: essence?.differentials ?? '',
    services: essence?.services ?? [],
    frequent_questions: essence?.frequent_questions ?? [],
    common_objections: essence?.common_objections ?? [],
    phrases: essence?.phrases ?? [],
    references_text: essence?.references_text ?? '',
  }
}

export default function Essencia() {
  const { state, setEssence } = useApp()
  const [activeTab, setActiveTab] = useState<Tab>('perfil')
  const [form, setForm] = useState<FormState>(initForm(state.essence))
  const [loading, setLoading] = useState(!state.essence)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [aiSummary, setAiSummary] = useState(state.essence?.ai_summary ?? '')
  const [summaryExpanded, setSummaryExpanded] = useState(false)

  useEffect(() => {
    if (!state.essence) {
      getBrandEssence()
        .then(data => {
          if (data) {
            setEssence(data)
            setForm(initForm(data))
            setAiSummary(data.ai_summary ?? '')
          }
        })
        .catch(console.error)
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const update = (key: keyof FormState, value: unknown) =>
    setForm(f => ({ ...f, [key]: value }))

  const toAnswers = (): Record<string, unknown> => ({
    profession: form.profession,
    niche: form.niche,
    audience: form.audience,
    tone_of_voice: form.tone_of_voice.join(', '),
    content_goals: form.content_goals,
    routine: form.routine,
    preferred_formats: form.preferred_formats,
    topics: form.topics,
    restrictions: form.restrictions,
    differentials: form.differentials,
    services: form.services,
    frequent_questions: form.frequent_questions,
    common_objections: form.common_objections,
    phrases: form.phrases,
    references_text: form.references_text,
  })

  // Salvar apenas os dados, sem gerar resumo IA
  const handleSave = async () => {
    if (!form.profession && !form.niche) { setError('Preencha ao menos a profissão ou nicho.'); return }
    setError('')
    setSaving(true)
    try {
      const saved = await saveBrandEssence(toAnswers())
      setEssence(saved)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  // Salvar + gerar resumo com IA (client-side Gemini → salva direto no banco)
  const handleGenerateWithAI = async () => {
    if (!form.profession && !form.niche) { setError('Preencha ao menos a profissão ou nicho.'); return }
    setError('')
    setGenerating(true)
    try {
      const answers = toAnswers()
      // 1) Salva os dados da essência primeiro (garante o registro)
      const savedEssence = await saveBrandEssence(answers)
      setEssence(savedEssence)
      // 2) Gera resumo + posicionamento com a IA
      const result = await generateEssenceSummary(answers)
      // 3) Persiste o resultado da IA na essência
      await updateEssenceSummary(savedEssence.id, result.aiSummary, result.aiPositioning)
      setAiSummary(result.aiSummary)
      // 4) Recarrega a essência atualizada
      const updated = await getBrandEssence()
      if (updated) { setEssence(updated); setForm(initForm(updated)) }
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao gerar resumo.'
      // Os dados já foram salvos acima; aqui só informamos a falha da IA
      setError(`Dados salvos, mas a IA não conseguiu gerar o resumo: ${msg}`)
    } finally {
      setGenerating(false)
    }
  }

  const toggleTone = (t: string) => {
    const current = form.tone_of_voice
    update('tone_of_voice', current.includes(t) ? current.filter(x => x !== t) : [...current, t])
  }

  const toggleFormat = (f: string) => {
    const current = form.preferred_formats
    update('preferred_formats', current.includes(f) ? current.filter(x => x !== f) : [...current, f])
  }

  const toggleRoutine = (m: string) => {
    const current = form.routine ? form.routine.split(',').map(s => s.trim()) : []
    const next = current.includes(m) ? current.filter(x => x !== m) : [...current, m]
    update('routine', next.join(', '))
  }

  const renderTab = () => {
    switch (activeTab) {
      case 'perfil':
        return (
          <div className="space-y-4">
            {[
              { label: 'Profissão / área de atuação', key: 'profession', placeholder: 'Ex: Nutricionista, Coach, Fotógrafa...' },
              { label: 'Nicho específico', key: 'niche', placeholder: 'Ex: Nutrição esportiva, Coaching executivo...' },
              { label: 'Público-alvo', key: 'audience', placeholder: 'Ex: Mulheres 25-40 que querem emagrecer...' },
              { label: 'Diferenciais', key: 'differentials', placeholder: 'O que te diferencia da concorrência...' },
              { label: 'Referências de estilo', key: 'references_text', placeholder: 'Criadores ou marcas que admira...' },
            ].map(({ label, key, placeholder }) => (
              <div key={key}>
                <label className="label">{label}</label>
                <input className="input" value={form[key as keyof FormState] as string ?? ''}
                  onChange={e => update(key as keyof FormState, e.target.value)} placeholder={placeholder} />
              </div>
            ))}
            <div>
              <label className="label">Objetivos com conteúdo</label>
              <textarea className="input resize-none" rows={3}
                value={form.content_goals}
                onChange={e => update('content_goals', e.target.value)}
                placeholder="Ex: Atrair mais pacientes, vender curso online, aumentar autoridade..." />
            </div>
          </div>
        )

      case 'tom':
        return (
          <div className="space-y-5">
            <div>
              <label className="label">Tom de voz</label>
              <div className="flex flex-wrap gap-2">
                {TONE_OPTIONS.map(t => {
                  const active = form.tone_of_voice.includes(t)
                  return (
                    <button key={t} onClick={() => toggleTone(t)}
                      className={`chip ${active ? 'chip-active' : 'chip-inactive'}`}>{t}</button>
                  )
                })}
              </div>
            </div>
            <TagInput
              label="Frases e bordões característicos"
              values={form.phrases}
              onChange={v => update('phrases', v)}
              placeholder='Ex: "Descomplica!", "Simples assim."'
            />
          </div>
        )

      case 'topicos':
        return (
          <div className="space-y-4">
            <TagInput
              label="Assuntos que você gosta de abordar"
              values={form.topics}
              onChange={v => update('topics', v)}
              placeholder="Ex: Alimentação antiinflamatória, Mindset..."
            />
            <TagInput
              label="Dúvidas frequentes do seu público"
              values={form.frequent_questions}
              onChange={v => update('frequent_questions', v)}
              placeholder="O que seu público mais pergunta..."
            />
            <TagInput
              label="Objeções comuns"
              values={form.common_objections}
              onChange={v => update('common_objections', v)}
              placeholder="Ex: É caro, não tenho tempo..."
            />
          </div>
        )

      case 'servicos':
        return (
          <div className="space-y-4">
            <TagInput
              label="Serviços e produtos que você oferece"
              values={form.services}
              onChange={v => update('services', v)}
              placeholder="Ex: Consulta, Mentoria, Curso online..."
            />
          </div>
        )

      case 'limites':
        return (
          <div className="space-y-4">
            <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>A IA vai respeitar isso em todas as sugestões.</p>
            <TagInput
              label="Temas que não quer abordar"
              values={form.restrictions}
              onChange={v => update('restrictions', v)}
              placeholder="Ex: Política, religião, casos polêmicos..."
            />
          </div>
        )

      case 'rotina':
        return (
          <div className="space-y-4">
            <div>
              <label className="label">Quando você tem tempo para gravar?</label>
              <div className="grid grid-cols-2 gap-2">
                {ROUTINE_OPTIONS.map(m => {
                  const current = form.routine ? form.routine.split(',').map(s => s.trim()) : []
                  const active = current.includes(m)
                  return (
                    <button key={m} onClick={() => toggleRoutine(m)}
                      className="p-3.5 rounded-2xl text-sm font-bold text-left transition-all duration-200"
                      style={active ? {
                        background: 'rgba(109,93,246,0.15)', border: '1px solid rgba(109,93,246,0.4)', color: '#9B8CFF',
                      } : {
                        background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)',
                      }}>{m}</button>
                  )
                })}
              </div>
            </div>
            <div>
              <label className="label">Formatos preferidos</label>
              <div className="flex flex-wrap gap-2">
                {FORMATS.map(f => {
                  const active = form.preferred_formats.includes(f)
                  return (
                    <button key={f} onClick={() => toggleFormat(f)}
                      className={`chip ${active ? 'chip-active' : 'chip-inactive'}`}>{f}</button>
                  )
                })}
              </div>
            </div>
          </div>
        )
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <span className="w-8 h-8 rounded-full animate-spin"
          style={{ border: '2px solid rgba(109,93,246,0.3)', borderTopColor: '#9B8CFF' }} />
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <div className="p-5 pb-0 relative z-10">
        <div className="flex items-center justify-between pt-4 mb-3">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>Minha Essência</h1>
            <p className="text-sm mt-1 font-medium" style={{ color: 'var(--text-secondary)' }}>
              {state.essence ? `Versão ${state.essence.version ?? 1} · O cérebro das suas ideias` : 'O cérebro das suas ideias'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Botão salvar simples */}
            <button
              onClick={handleSave}
              disabled={saving || generating}
              className="flex items-center gap-2 text-sm font-bold px-3 py-2 rounded-2xl transition-all duration-300"
              style={saved ? {
                background: 'linear-gradient(135deg, #53D6A1, #3BB88A)', color: 'white',
              } : {
                background: 'var(--bg-card)', border: '1px solid var(--border-bright)', color: 'var(--text-secondary)',
              }}
            >
              {saving ? <span className="w-4 h-4 border border-current border-t-transparent rounded-full animate-spin" /> : <Save size={14} />}
              {saved ? 'Salvo!' : 'Salvar'}
            </button>

            {/* Botão gerar com IA */}
            <button
              onClick={handleGenerateWithAI}
              disabled={saving || generating}
              className="flex items-center gap-2 text-sm font-bold px-3 py-2 rounded-2xl transition-all duration-300"
              style={{
                background: 'linear-gradient(135deg, #6D5DF6, #9B8CFF)',
                boxShadow: '0 0 20px rgba(109,93,246,0.4)',
                color: 'white',
              }}
            >
              {generating
                ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : state.essence?.ai_summary ? <RefreshCw size={14} /> : <Sparkles size={14} />
              }
              {generating ? 'Gerando...' : state.essence?.ai_summary ? 'Atualizar IA' : 'Gerar com IA'}
            </button>
          </div>
        </div>

        {/* Resumo IA — clicável para expandir e ler tudo */}
        {aiSummary && (
          <div className="mb-3 rounded-2xl p-4"
            style={{ background: 'rgba(109,93,246,0.08)', border: '1px solid rgba(109,93,246,0.2)' }}>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#9B8CFF' }}>Resumo gerado pela IA</p>
            <p className="text-xs leading-relaxed whitespace-pre-line" style={{ color: 'var(--text-secondary)' }}>
              {summaryExpanded || aiSummary.length <= 200
                ? aiSummary
                : `${aiSummary.slice(0, 200)}…`}
            </p>
            {aiSummary.length > 200 && (
              <button
                onClick={() => setSummaryExpanded(v => !v)}
                className="mt-2 text-xs font-bold"
                style={{ color: '#9B8CFF' }}
              >
                {summaryExpanded ? 'Ver menos' : 'Ver tudo'}
              </button>
            )}
          </div>
        )}

        {error && (
          <div className="mb-3 rounded-xl px-4 py-3 text-sm font-semibold"
            style={{ background: 'rgba(255,122,107,0.1)', border: '1px solid rgba(255,122,107,0.2)', color: '#FF7A6B' }}>
            {error}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-hide">
          {TABS.map(({ value, label, icon }) => (
            <button
              key={value}
              onClick={() => setActiveTab(value)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-200"
              style={activeTab === value ? {
                background: 'linear-gradient(135deg, rgba(109,93,246,0.3), rgba(155,140,255,0.2))',
                border: '1px solid rgba(109,93,246,0.4)', color: '#9B8CFF',
                boxShadow: '0 0 12px rgba(109,93,246,0.2)',
              } : {
                background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)',
              }}
            >
              {icon}{label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5 pb-28 relative z-10">
        <div className="animate-fade-up">{renderTab()}</div>
      </div>
    </div>
  )
}
