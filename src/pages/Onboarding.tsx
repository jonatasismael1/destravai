import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { updateProfile } from '../services/profileService'
import { saveBrandEssence } from '../services/essenceService'
import type { ProfessionalProfile, ContentPillar, ServiceTopic, ExposureLevel } from '../types'
import { ChevronLeft, ChevronRight, Check, Eye, Mic, MicOff, Film, Monitor } from 'lucide-react'

const TOTAL_STEPS = 8

const GOALS = [
  'Atrair mais clientes',
  'Vender mais / fechar mais serviços',
  'Divulgar um produto ou serviço',
  'Aumentar autoridade',
  'Aparecer mais nos stories',
  'Humanizar o perfil',
  'Lançar uma campanha específica',
]

const EXPOSURE_OPTIONS: {
  value: ExposureLevel
  label: string
  desc: string
  Icon: typeof Eye
}[] = [
  { value: 'no-appearance', label: 'Sem aparecer', desc: 'Texto e imagens apenas — sem rosto', Icon: Monitor },
  { value: 'appear-no-talk', label: 'Aparecer, sem falar', desc: 'Presença visual sem voz', Icon: Eye },
  { value: 'short-videos', label: 'Vídeos curtos', desc: 'Até 30s — direto e prático', Icon: Film },
  { value: 'comfortable-talking', label: 'Confortável falando', desc: 'Falo direto para câmera', Icon: Mic },
  { value: 'humor-backstage', label: 'Humor e bastidores', desc: 'Gosto de me mostrar à vontade', Icon: MicOff },
]

const TONE_OPTIONS = [
  'Didática', 'Direta', 'Elegante', 'Bem-humorada',
  'Acolhedora', 'Técnica', 'Leve', 'Sofisticada', 'Próxima', 'Provocativa',
]

const DEFAULT_PILLARS = [
  'Autoridade na minha área',
  'Bastidores do meu dia a dia',
  'Conexão com o público',
  'Venda natural do meu serviço',
  'Educação e dúvidas frequentes',
  'Dicas práticas e rápidas',
  'Histórias e casos reais',
  'Mitos e verdades',
]

const SERVICE_SUGGESTIONS = [
  'Atendimento individual', 'Consultoria', 'Mentoria', 'Curso ou workshop',
  'Pacote de serviços', 'Avaliação inicial', 'Acompanhamento', 'Produto digital',
]

// Por que este step importa para a Deby
const STEP_CONTEXT = [
  'Isso personaliza cada roteiro com o seu nome, área e estilo de comunicação.',
  'Seu objetivo guia o tipo e o tom de cada conteúdo gerado.',
  'A Deby adapta o formato de story pro seu nível de conforto — sem forçar.',
  'Seu tom de voz faz cada roteiro soar como você, não como um robô.',
  'Os pilares definem os temas que a Deby vai priorizar nas sugestões.',
  'Com seus serviços, a Deby cria CTAs naturais que convertem sem parecer venda.',
  'A Deby vai respeitar esses limites em todos os roteiros gerados.',
  'Bordão e palavras preferidas fazem a diferença entre parecer você ou qualquer um.',
]

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5 mb-6">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className="h-1 rounded-full transition-all duration-500"
          style={{
            flexGrow: i === current ? 2 : 1,
            background: i <= current ? 'var(--brand)' : 'var(--border-strong)',
          }}
        />
      ))}
    </div>
  )
}

function MultiChip({ options, selected, onToggle }: {
  options: string[]
  selected: string[]
  onToggle: (v: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => {
        const active = selected.includes(opt)
        return (
          <button
            key={opt}
            onClick={() => onToggle(opt)}
            className="chip transition-all duration-200"
            style={active ? {
              background: 'var(--brand-soft)',
              border: '1px solid var(--brand-border)',
              color: 'var(--brand)',
            } : {
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-secondary)',
            }}
          >
            {active && <Check size={11} />}
            {opt}
          </button>
        )
      })}
    </div>
  )
}

// Dica contextual para motivar preenchimento
function ContextTip({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-2xl px-4 py-3 mb-5"
      style={{ background: 'rgba(124,92,255,0.07)', border: '1px solid rgba(124,92,255,0.15)' }}>
      <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ background: 'rgba(124,92,255,0.2)' }}>
        <Check size={10} style={{ color: '#A78BFA' }} />
      </div>
      <p className="text-xs font-semibold leading-relaxed" style={{ color: '#A78BFA' }}>{text}</p>
    </div>
  )
}

export default function Onboarding() {
  const { state, setProfile, setLocalProfile, setEssence } = useApp()
  const [step, setStep] = useState(0)
  const [finishing, setFinishing] = useState(false)

  const [professionalName, setProfessionalName] = useState(
    state.profile?.name ?? state.supabaseUser?.user_metadata?.name ?? ''
  )
  const [specialty, setSpecialty] = useState('')
  const [city, setCity] = useState('')
  const [targetAudience, setTargetAudience] = useState('')
  const [instagram, setInstagram] = useState('')
  const [serviceType, setServiceType] = useState('')
  const [currentGoal, setCurrentGoal] = useState('')
  const [exposureLevel, setExposureLevel] = useState<ExposureLevel>('short-videos')
  const [voiceTone, setVoiceTone] = useState<string[]>([])
  const [selectedPillars, setSelectedPillars] = useState<string[]>([])
  const [selectedServices, setSelectedServices] = useState<string[]>([])
  const [catchphrase, setCatchphrase] = useState('')
  const [avoidedWords, setAvoidedWords] = useState('')
  const [avoidTopics, setAvoidTopics] = useState('')

  const handleToneToggle = (t: string) =>
    setVoiceTone(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])
  const handlePillarToggle = (p: string) =>
    setSelectedPillars(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])
  const handleServiceToggle = (s: string) =>
    setSelectedServices(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])

  const canAdvance = () => {
    switch (step) {
      case 0: return !!(professionalName && specialty)
      case 1: return !!currentGoal
      case 2: return !!exposureLevel
      case 3: return voiceTone.length > 0
      case 4: return selectedPillars.length > 0
      case 5: return selectedServices.length > 0
      default: return true
    }
  }

  const handleFinish = async () => {
    setFinishing(true)
    try {
      const pillars: ContentPillar[] = selectedPillars.map((name, i) => ({
        id: crypto.randomUUID(), name, description: '', priority: i + 1,
      }))
      const services: ServiceTopic[] = selectedServices.map(name => ({
        id: crypto.randomUUID(), name, category: specialty || 'Geral', commercialGoal: 'Venda',
      }))

      const localProfile: ProfessionalProfile = {
        professionalName, specialty, city, targetAudience, instagram, serviceType,
        currentGoal, exposureLevel, voiceTone, pillars, services,
        limits: {
          avoidTopics: avoidTopics.split(',').map(s => s.trim()).filter(Boolean),
          sensitiveMatter: [], noTeamShow: false, noOfficeShow: false, humorRestrictions: '',
        },
        catchphrase,
        preferredWords: [],
        avoidedWords: avoidedWords.split(',').map(s => s.trim()).filter(Boolean),
        availableMoments: [],
      }
      setLocalProfile(localProfile)

      const essenceAnswers = {
        profession: specialty,
        niche: specialty,
        audience: targetAudience,
        tone_of_voice: voiceTone.join(', '),
        content_goals: currentGoal,
        routine: serviceType,
        topics: selectedPillars,
        services: selectedServices,
        restrictions: avoidTopics.split(',').map(s => s.trim()).filter(Boolean),
        phrases: catchphrase ? [catchphrase] : [],
        differentials: '',
        frequent_questions: [],
        common_objections: [],
        // Campos extras guardados no raw_answers_json para reconstruir o perfil
        // em qualquer dispositivo (não têm coluna própria na tabela de essência)
        professional_name: professionalName,
        city,
        instagram,
        exposure_level: exposureLevel,
        avoided_words: avoidedWords.split(',').map(s => s.trim()).filter(Boolean),
      }
      const savedEssence = await saveBrandEssence(essenceAnswers)
      setEssence(savedEssence)

      const updatedProfile = await updateProfile({
        onboarding_completed: true,
        name: professionalName,
        profession: specialty,
      })
      setProfile(updatedProfile)
    } catch (err) {
      console.error('Erro ao finalizar onboarding:', err)
      const supabaseProfile = await updateProfile({ onboarding_completed: true, name: professionalName }).catch(() => null)
      if (supabaseProfile) setProfile(supabaseProfile)
    } finally {
      setFinishing(false)
    }
  }

  const STEP_TITLES = [
    'Quem é você?',
    'Qual é seu foco agora?',
    'Como você prefere aparecer?',
    'Como quer ser percebido(a)?',
    'Seus pilares de conteúdo',
    'O que você oferece?',
    'O que não combina com você?',
    'Sua identidade de fala',
  ]

  const STEP_SUBTITLES = [
    'Sua área e nome moldam cada roteiro gerado.',
    'A Deby prioriza o tipo de conteúdo mais certo pro seu momento.',
    'Sem pressão. Você pode evoluir isso quando quiser.',
    'Escolha os atributos que definem como você se comunica.',
    'Os temas que sustentam sua presença e geram autoridade.',
    'Com seus serviços, a Deby cria CTAs que vendem sem parecer venda.',
    'A Deby vai respeitar esses limites em todos os roteiros.',
    'Bordão e palavras deixam cada ideia com a sua identidade.',
  ]

  const steps = [
    // Step 0
    <div key={0} className="space-y-4">
      <div>
        <label className="label">Nome profissional</label>
        <input className="input" value={professionalName} onChange={e => setProfessionalName(e.target.value)} placeholder="Ex: Ana Lima, Dr. Carlos, @anaverde" />
      </div>
      <div>
        <label className="label">Área de atuação <span style={{ color: '#FF7A6B' }}>*</span></label>
        <input className="input" value={specialty} onChange={e => setSpecialty(e.target.value)} placeholder="Ex: Nutricionista, Coach, Fotógrafa, Advogada..." />
        <p className="text-xs mt-1.5 font-medium" style={{ color: 'var(--text-muted)' }}>
          Obrigatório — define o vocabulário e o nicho dos roteiros.
        </p>
      </div>
      <div>
        <label className="label">Público principal</label>
        <input className="input" value={targetAudience} onChange={e => setTargetAudience(e.target.value)} placeholder="Ex: Mulheres 25-40, empreendedores iniciantes..." />
      </div>
      <div>
        <label className="label">Cidade</label>
        <input className="input" value={city} onChange={e => setCity(e.target.value)} placeholder="Ex: São Paulo, SP" />
      </div>
      <div>
        <label className="label">Instagram</label>
        <input className="input" value={instagram} onChange={e => setInstagram(e.target.value)} placeholder="@seuperfil" />
      </div>
    </div>,

    // Step 1
    <div key={1} className="space-y-2">
      {GOALS.map(g => (
        <button
          key={g}
          onClick={() => setCurrentGoal(g)}
          className="w-full text-left px-4 py-3.5 rounded-2xl font-semibold text-sm transition-all duration-200"
          style={currentGoal === g ? {
            background: 'rgba(109,93,246,0.15)',
            border: '1px solid rgba(109,93,246,0.4)',
            color: 'var(--brand)',
          } : {
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-secondary)',
          }}
        >
          <span className="flex items-center gap-2">
            {currentGoal === g && <Check size={14} style={{ color: '#9B8CFF' }} />}
            {g}
          </span>
        </button>
      ))}
    </div>,

    // Step 2 — ícones vetoriais no lugar de emojis
    <div key={2} className="space-y-2">
      {EXPOSURE_OPTIONS.map(({ value, label, desc, Icon }) => (
        <button
          key={value}
          onClick={() => setExposureLevel(value)}
          className="w-full text-left px-4 py-3.5 rounded-2xl transition-all duration-200 flex items-center gap-3"
          style={exposureLevel === value ? {
            background: 'var(--brand-soft)',
            border: '1px solid var(--brand-border)',
          } : {
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={exposureLevel === value
              ? { background: 'var(--brand-soft)', border: '1px solid var(--brand-border)' }
              : { background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
          >
            <Icon size={18} style={{ color: exposureLevel === value ? '#9B8CFF' : 'var(--text-muted)' }} />
          </div>
          <div>
            <span className="block font-bold text-sm" style={{ color: exposureLevel === value ? '#9B8CFF' : 'var(--text-primary)' }}>
              {label}
            </span>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{desc}</span>
          </div>
        </button>
      ))}
    </div>,

    // Step 3
    <div key={3} className="space-y-4">
      <MultiChip options={TONE_OPTIONS} selected={voiceTone} onToggle={handleToneToggle} />
      {voiceTone.length > 0 && (
        <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
          {voiceTone.length} atributo{voiceTone.length > 1 ? 's' : ''} selecionado{voiceTone.length > 1 ? 's' : ''}. Pode escolher mais de um.
        </p>
      )}
    </div>,

    // Step 4
    <div key={4} className="space-y-4">
      <MultiChip options={DEFAULT_PILLARS} selected={selectedPillars} onToggle={handlePillarToggle} />
      <div>
        <label className="label">Pilar personalizado</label>
        <input className="input" placeholder="Digite e pressione Enter..."
          onKeyDown={e => { if (e.key === 'Enter' && e.currentTarget.value) { handlePillarToggle(e.currentTarget.value); e.currentTarget.value = '' } }} />
      </div>
      {selectedPillars.length > 0 && (
        <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
          {selectedPillars.length} pilar{selectedPillars.length > 1 ? 'es' : ''} selecionado{selectedPillars.length > 1 ? 's' : ''}.
        </p>
      )}
    </div>,

    // Step 5
    <div key={5} className="space-y-4">
      <MultiChip options={SERVICE_SUGGESTIONS} selected={selectedServices} onToggle={handleServiceToggle} />
      <div>
        <label className="label">Adicionar serviço ou produto</label>
        <input className="input" placeholder="Digite o seu e pressione Enter..."
          onKeyDown={e => { if (e.key === 'Enter' && e.currentTarget.value) { handleServiceToggle(e.currentTarget.value); e.currentTarget.value = '' } }} />
      </div>
    </div>,

    // Step 6
    <div key={6} className="space-y-4">
      <div>
        <label className="label">Temas que não quer abordar</label>
        <input className="input" value={avoidTopics} onChange={e => setAvoidTopics(e.target.value)} placeholder="Ex: Política, religião (separados por vírgula)" />
        <p className="text-xs mt-1.5 font-medium" style={{ color: 'var(--text-muted)' }}>Opcional — mas importante para a Deby nunca errar o tom.</p>
      </div>
      <div>
        <label className="label">Palavras que evita</label>
        <input className="input" value={avoidedWords} onChange={e => setAvoidedWords(e.target.value)} placeholder="Ex: guru, próspero, incrível (separadas por vírgula)" />
      </div>
      <div>
        <label className="label">Modelo de atendimento</label>
        <input className="input" value={serviceType} onChange={e => setServiceType(e.target.value)} placeholder="Ex: Presencial, online, híbrido" />
      </div>
    </div>,

    // Step 7 — final
    <div key={7} className="space-y-4">
      <div>
        <label className="label">Bordão principal <span style={{ color: 'var(--text-muted)' }}>(opcional)</span></label>
        <input className="input" value={catchphrase} onChange={e => setCatchphrase(e.target.value)} placeholder='Ex: "Descomplica!", "Bora pra cima!", "Simples assim."' />
        <p className="text-xs mt-1.5 font-medium" style={{ color: 'var(--text-muted)' }}>
          A Deby vai usar isso no final dos roteiros quando fizer sentido.
        </p>
      </div>

      {/* Resumo do que foi configurado */}
      <div className="rounded-2xl p-4 space-y-2"
        style={{ background: 'rgba(109,93,246,0.07)', border: '1px solid rgba(109,93,246,0.18)' }}>
        <p className="text-xs font-extrabold uppercase tracking-widest mb-3" style={{ color: '#9B8CFF' }}>
          Seu perfil está pronto
        </p>
        {[
          specialty && `Área: ${specialty}`,
          currentGoal && `Foco: ${currentGoal}`,
          voiceTone.length && `Tom: ${voiceTone.slice(0, 2).join(', ')}${voiceTone.length > 2 ? ` +${voiceTone.length - 2}` : ''}`,
          selectedPillars.length && `${selectedPillars.length} pilar${selectedPillars.length > 1 ? 'es' : ''} de conteúdo`,
          selectedServices.length && `${selectedServices.length} serviço${selectedServices.length > 1 ? 's' : ''}`,
        ].filter(Boolean).map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <Check size={12} style={{ color: '#9B8CFF' }} />
            <p className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>{item}</p>
          </div>
        ))}
        <p className="text-sm font-bold mt-3 pt-3" style={{ color: 'var(--text-primary)', borderTop: '1px solid rgba(109,93,246,0.15)' }}>
          Cada ideia vai parecer sua — não de um app genérico.
        </p>
      </div>
    </div>,
  ]

  return (
    <div className="h-full flex flex-col max-w-md mx-auto relative overflow-y-auto" style={{ background: 'var(--bg-base)', minHeight: '100svh' }}>
      <div className="flex-1 p-6 overflow-y-auto relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-5 pt-2">
          <div className="flex items-center gap-2.5">
            <img
              src="/destravai-icone.png"
              alt="Destravaí"
              className="w-8 h-8 rounded-xl object-cover"
            />
            <span className="font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>Destravaí</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Expectativa de tempo logo no início, para reduzir o atrito de começar */}
            {step === 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(83,214,161,0.12)', border: '1px solid rgba(83,214,161,0.25)', color: '#53D6A1' }}>
                ~2 min
              </span>
            )}
            <span className="text-xs font-bold tabular-nums" style={{ color: 'var(--text-muted)' }}>
              {step + 1} / {TOTAL_STEPS}
            </span>
          </div>
        </div>

        <StepIndicator current={step} total={TOTAL_STEPS} />

        {/* Título e subtítulo do step */}
        <div className="mb-4 animate-fade-up">
          <h2 className="text-2xl font-extrabold tracking-tight mb-1" style={{ color: 'var(--text-primary)' }}>
            {STEP_TITLES[step]}
          </h2>
          <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
            {STEP_SUBTITLES[step]}
          </p>
        </div>

        {/* Dica contextual de por que isso importa */}
        <ContextTip text={STEP_CONTEXT[step]} />

        <div className="animate-fade-up">{steps[step]}</div>
      </div>

      {/* Navegação fixa no rodapé */}
      <div className="p-6 flex gap-3 relative z-10"
        style={{ background: 'var(--nav-bg)', borderTop: '1px solid var(--nav-border)', backdropFilter: 'blur(20px)' }}>
        {step > 0 && (
          <button onClick={() => setStep(s => s - 1)} className="btn-secondary flex-1 gap-2">
            <ChevronLeft size={18} /> Voltar
          </button>
        )}
        {step < TOTAL_STEPS - 1 ? (
          <button
            onClick={() => setStep(s => s + 1)}
            disabled={!canAdvance()}
            className="btn-primary flex-1 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Continuar <ChevronRight size={18} />
          </button>
        ) : (
          <button onClick={handleFinish} disabled={finishing} className="btn-primary flex-1">
            {finishing
              ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <><Check size={18} /> Começar agora</>
            }
          </button>
        )}
      </div>
    </div>
  )
}
