import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X, ChevronRight, ChevronLeft, Check } from 'lucide-react'
import type { PersonalContext } from '../types'
import { useApp } from '../context/AppContext'

interface Props {
  onClose: () => void
}

const VALUE_OPTIONS = [
  'Família', 'Saúde', 'Liberdade', 'Aprendizado',
  'Criatividade', 'Conexão', 'Impacto', 'Equilíbrio',
  'Autenticidade', 'Leveza', 'Crescimento', 'Propósito',
]

const HOBBY_SUGGESTIONS = [
  'Leitura', 'Música', 'Culinária', 'Viagens',
  'Esportes', 'Arte', 'Séries/filmes', 'Natureza',
  'Meditação', 'Fotografia', 'Dança', 'Yoga',
]

export default function PersonalSetupModal({ onClose }: Props) {
  const { savePersonalContext } = useApp()
  const [step, setStep] = useState(1)
  const [form, setForm] = useState<PersonalContext>({
    nickname: '',
    lifeMoment: '',
    hobbies: [],
    personalValues: [],
    motivations: '',
  })
  const [hobbyInput, setHobbyInput] = useState('')

  const totalSteps = 3

  function toggleHobby(h: string) {
    setForm(f => ({
      ...f,
      hobbies: f.hobbies?.includes(h)
        ? f.hobbies.filter(x => x !== h)
        : [...(f.hobbies ?? []), h],
    }))
  }

  function toggleValue(v: string) {
    setForm(f => ({
      ...f,
      personalValues: f.personalValues?.includes(v)
        ? f.personalValues.filter(x => x !== v)
        : [...(f.personalValues ?? []), v],
    }))
  }

  function addCustomHobby() {
    const trimmed = hobbyInput.trim()
    if (!trimmed || form.hobbies?.includes(trimmed)) return
    setForm(f => ({ ...f, hobbies: [...(f.hobbies ?? []), trimmed] }))
    setHobbyInput('')
  }

  function handleSave() {
    savePersonalContext({ ...form, setupCompleted: true })
    onClose()
  }

  function handleSkip() {
    savePersonalContext({ setupSkipped: true })
    onClose()
  }

  const progressWidth = `${(step / totalSteps) * 100}%`

  return createPortal((
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center"
      style={{
        background: 'rgba(0,0,0,0.4)',
        backdropFilter: 'blur(4px)',
        padding: 'max(env(safe-area-inset-top), 12px) 12px max(env(safe-area-inset-bottom), 12px)',
      }}
    >
      <div
        className="w-full max-w-md rounded-3xl"
        style={{
          background: '#FFFFFF',
          maxHeight: 'calc(100dvh - max(env(safe-area-inset-top), 12px) - max(env(safe-area-inset-bottom), 12px))',
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div>
            <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#6D5DF6' }}>
              Etapa {step} de {totalSteps}
            </p>
            <h2 className="text-xl font-bold mt-0.5" style={{ color: '#1A1625' }}>
              Seu espaço pessoal ✨
            </h2>
          </div>
          <button
            onClick={handleSkip}
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: '#F0EEFF' }}
          >
            <X size={16} style={{ color: '#6D5DF6' }} />
          </button>
        </div>

        {/* Progress bar */}
        <div className="px-5 mb-6">
          <div className="h-1.5 rounded-full" style={{ background: '#F0EEFF' }}>
            <div
              className="h-1.5 rounded-full transition-all duration-500"
              style={{ width: progressWidth, background: 'linear-gradient(90deg, #6D5DF6, #9B8CFF)' }}
            />
          </div>
        </div>

        {/* Step 1: Nome + momento de vida */}
        {step === 1 && (
          <div className="px-5 space-y-5">
            <div>
              <p className="text-2xl mb-1">👋</p>
              <h3 className="text-lg font-bold mb-1" style={{ color: '#1A1625' }}>
                Como posso te chamar?
              </h3>
              <p className="text-sm mb-3" style={{ color: '#6B6487' }}>
                Um apelido ou seu primeiro nome — o que preferir.
              </p>
              <input
                type="text"
                value={form.nickname}
                onChange={e => setForm(f => ({ ...f, nickname: e.target.value }))}
                placeholder="Ex: Ana, Dra. Lima, Rê..."
                className="w-full rounded-2xl px-4 py-3 text-base outline-none transition-all"
                style={{
                  background: '#F6F5FF',
                  border: '1.5px solid rgba(109,93,246,0.15)',
                  color: '#1A1625',
                  fontFamily: 'inherit',
                }}
                onFocus={e => e.currentTarget.style.borderColor = 'rgba(109,93,246,0.5)'}
                onBlur={e => e.currentTarget.style.borderColor = 'rgba(109,93,246,0.15)'}
              />
            </div>

            <div>
              <p className="text-2xl mb-1">🌱</p>
              <h3 className="text-lg font-bold mb-1" style={{ color: '#1A1625' }}>
                O que está acontecendo na sua vida agora?
              </h3>
              <p className="text-sm mb-3" style={{ color: '#6B6487' }}>
                Pode ser pessoal ou profissional. A IA vai usar isso para criar conteúdos mais autênticos.
              </p>
              <textarea
                value={form.lifeMoment}
                onChange={e => setForm(f => ({ ...f, lifeMoment: e.target.value }))}
                placeholder="Ex: Acabei de abrir meu consultório, estou num momento de renovação, passando por mudanças na família..."
                rows={4}
                className="w-full rounded-2xl px-4 py-3 text-sm outline-none resize-none transition-all"
                style={{
                  background: '#F6F5FF',
                  border: '1.5px solid rgba(109,93,246,0.15)',
                  color: '#1A1625',
                  fontFamily: 'inherit',
                  lineHeight: '1.6',
                }}
                onFocus={e => e.currentTarget.style.borderColor = 'rgba(109,93,246,0.5)'}
                onBlur={e => e.currentTarget.style.borderColor = 'rgba(109,93,246,0.15)'}
              />
            </div>
          </div>
        )}

        {/* Step 2: Hobbies */}
        {step === 2 && (
          <div className="px-5 space-y-5">
            <div>
              <p className="text-2xl mb-1">🎨</p>
              <h3 className="text-lg font-bold mb-1" style={{ color: '#1A1625' }}>
                Seus hobbies e interesses
              </h3>
              <p className="text-sm mb-4" style={{ color: '#6B6487' }}>
                O que você gosta fora do trabalho? Selecione ou adicione os seus.
              </p>

              <div className="flex flex-wrap gap-2 mb-4">
                {HOBBY_SUGGESTIONS.map(h => {
                  const selected = form.hobbies?.includes(h)
                  return (
                    <button
                      key={h}
                      onClick={() => toggleHobby(h)}
                      className="px-3.5 py-1.5 rounded-full text-sm font-medium transition-all duration-200"
                      style={selected ? {
                        background: 'linear-gradient(135deg, #6D5DF6, #9B8CFF)',
                        color: '#fff',
                      } : {
                        background: '#F0EEFF',
                        color: '#6D5DF6',
                      }}
                    >
                      {selected && '✓ '}{h}
                    </button>
                  )
                })}
              </div>

              {/* Custom hobbies */}
              {(form.hobbies?.filter(h => !HOBBY_SUGGESTIONS.includes(h)) ?? []).length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {form.hobbies?.filter(h => !HOBBY_SUGGESTIONS.includes(h)).map(h => (
                    <span
                      key={h}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium"
                      style={{ background: 'linear-gradient(135deg, #6D5DF6, #9B8CFF)', color: '#fff' }}
                    >
                      ✓ {h}
                      <button onClick={() => toggleHobby(h)} className="ml-0.5 opacity-70 hover:opacity-100">
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <input
                  type="text"
                  value={hobbyInput}
                  onChange={e => setHobbyInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addCustomHobby()}
                  placeholder="Adicionar outro..."
                  className="flex-1 rounded-2xl px-4 py-2.5 text-sm outline-none"
                  style={{
                    background: '#F6F5FF',
                    border: '1.5px solid rgba(109,93,246,0.15)',
                    color: '#1A1625',
                    fontFamily: 'inherit',
                  }}
                />
                <button
                  onClick={addCustomHobby}
                  className="px-4 py-2.5 rounded-2xl text-sm font-semibold"
                  style={{ background: 'linear-gradient(135deg, #6D5DF6, #9B8CFF)', color: '#fff' }}
                >
                  +
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Valores + motivações */}
        {step === 3 && (
          <div className="px-5 space-y-5">
            <div>
              <p className="text-2xl mb-1">💎</p>
              <h3 className="text-lg font-bold mb-1" style={{ color: '#1A1625' }}>
                Seus valores mais importantes
              </h3>
              <p className="text-sm mb-4" style={{ color: '#6B6487' }}>
                O que guia sua vida e suas decisões? (escolha até 5)
              </p>

              <div className="flex flex-wrap gap-2 mb-5">
                {VALUE_OPTIONS.map(v => {
                  const selected = form.personalValues?.includes(v)
                  const maxReached = (form.personalValues?.length ?? 0) >= 5 && !selected
                  return (
                    <button
                      key={v}
                      onClick={() => !maxReached && toggleValue(v)}
                      className="px-3.5 py-1.5 rounded-full text-sm font-medium transition-all duration-200"
                      style={selected ? {
                        background: 'linear-gradient(135deg, #6D5DF6, #9B8CFF)',
                        color: '#fff',
                      } : {
                        background: maxReached ? '#F5F5F5' : '#F0EEFF',
                        color: maxReached ? '#BBBBBB' : '#6D5DF6',
                      }}
                    >
                      {selected && '✓ '}{v}
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <p className="text-2xl mb-1">🚀</p>
              <h3 className="text-lg font-bold mb-1" style={{ color: '#1A1625' }}>
                O que te motiva fora do trabalho?
              </h3>
              <p className="text-sm mb-3" style={{ color: '#6B6487' }}>
                Uma frase, uma visão, um sonho. Qualquer coisa que te move.
              </p>
              <textarea
                value={form.motivations}
                onChange={e => setForm(f => ({ ...f, motivations: e.target.value }))}
                placeholder="Ex: Ver minha família bem, viajar pelo mundo, fazer diferença na vida das pessoas..."
                rows={3}
                className="w-full rounded-2xl px-4 py-3 text-sm outline-none resize-none"
                style={{
                  background: '#F6F5FF',
                  border: '1.5px solid rgba(109,93,246,0.15)',
                  color: '#1A1625',
                  fontFamily: 'inherit',
                  lineHeight: '1.6',
                }}
                onFocus={e => e.currentTarget.style.borderColor = 'rgba(109,93,246,0.5)'}
                onBlur={e => e.currentTarget.style.borderColor = 'rgba(109,93,246,0.15)'}
              />
            </div>
          </div>
        )}

        {/* Buttons */}
        <div
          className="sticky bottom-0 z-10 px-5 pt-4 pb-5 flex gap-3"
          style={{ background: '#FFFFFF', borderTop: '1px solid rgba(109,93,246,0.08)' }}
        >
          {step > 1 && (
            <button
              onClick={() => setStep(s => s - 1)}
              className="flex items-center gap-1.5 px-5 py-3 rounded-2xl font-semibold text-sm"
              style={{ background: '#F0EEFF', color: '#6D5DF6' }}
            >
              <ChevronLeft size={16} />
              Voltar
            </button>
          )}

          {step < totalSteps ? (
            <button
              onClick={() => setStep(s => s + 1)}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm"
              style={{ background: 'linear-gradient(135deg, #6D5DF6, #9B8CFF)', color: '#fff' }}
            >
              Continuar
              <ChevronRight size={16} />
            </button>
          ) : (
            <button
              onClick={handleSave}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm"
              style={{ background: 'linear-gradient(135deg, #6D5DF6, #9B8CFF)', color: '#fff' }}
            >
              <Check size={16} />
              Salvar e começar
            </button>
          )}
        </div>

        {step === 1 && (
          <div className="px-5 pb-6 text-center">
            <button
              onClick={handleSkip}
              className="text-sm"
              style={{ color: '#A09BB8' }}
            >
              Pular por agora, faço depois
            </button>
          </div>
        )}
      </div>
    </div>
  ), document.body)
}
