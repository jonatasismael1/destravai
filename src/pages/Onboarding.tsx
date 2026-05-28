import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { updateProfile } from '../services/profileService'
import { saveBrandEssence } from '../services/essenceService'
import type { ProfessionalProfile, ContentPillar, ServiceTopic, ExposureLevel } from '../types'
import { ChevronLeft, ChevronRight, Zap, Check } from 'lucide-react'

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

const EXPOSURE_OPTIONS: { value: ExposureLevel; label: string; desc: string; emoji: string }[] = [
  { value: 'no-appearance', label: 'Sem aparecer', desc: 'Texto e imagens apenas', emoji: '🖼️' },
  { value: 'appear-no-talk', label: 'Aparecer, sem falar', desc: 'Presença sem voz', emoji: '🤫' },
  { value: 'short-videos', label: 'Vídeos curtos', desc: 'Prefiro vídeos de até 30s', emoji: '📱' },
  { value: 'comfortable-talking', label: 'Confortável falando', desc: 'Falo direto para câmera', emoji: '🎤' },
  { value: 'humor-backstage', label: 'Humor e bastidores', desc: 'Gosto de me mostrar', emoji: '🎭' },
]

const TONE_OPTIONS = [
  'Didática', 'Direta', 'Elegante', 'Bem-humorada',
  'Acolhedora', 'Técnica', 'Leve', 'Sofisticada', 'Próxima', 'Provocativa',
]

// Sugestões universais de pilares — servem para qualquer nicho.
// A IA personaliza o conteúdo depois com base na área de atuação digitada.
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

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5 mb-8">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className="h-1 rounded-full transition-all duration-500"
          style={{
            flexGrow: i === current ? 2 : 1,
            background: i < current
              ? 'linear-gradient(90deg, #6D5DF6, #9B8CFF)'
              : i === current
              ? 'linear-gradient(90deg, #6D5DF6, #9B8CFF)'
              : 'rgba(255,255,255,0.1)',
            boxShadow: i <= current ? '0 0 8px rgba(109,93,246,0.4)' : 'none',
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
              background: 'linear-gradient(135deg, #6D5DF6, #9B8CFF)',
              color: 'white',
              boxShadow: '0 0 14px rgba(109,93,246,0.4)',
            } : {
              background: 'var(--bg-card)',
              border: '1px solid rgba(255,255,255,0.10)',
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

  const pillarsToShow = DEFAULT_PILLARS

  const handleToneToggle = (t: string) =>
    setVoiceTone(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])
  const handlePillarToggle = (p: string) =>
    setSelectedPillars(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])
  const handleServiceToggle = (s: string) =>
    setSelectedServices(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])

  const canAdvance = () => {
    switch (step) {
      case 0: return professionalName && specialty
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

      // Salvar perfil local (compatibilidade com chamadas de IA legadas em Home/Criar)
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

      // Salvar essência básica no banco (sem gerar resumo IA agora — faremos depois na tela Essência)
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
      }
      const savedEssence = await saveBrandEssence(essenceAnswers)
      setEssence(savedEssence)

      // Marcar onboarding como completo no banco
      const updatedProfile = await updateProfile({
        onboarding_completed: true,
        name: professionalName,
        profession: specialty,
      })
      setProfile(updatedProfile)
    } catch (err) {
      console.error('Erro ao finalizar onboarding:', err)
      // Mesmo com erro no banco, deixar o usuário prosseguir
      const supabaseProfile = await updateProfile({ onboarding_completed: true, name: professionalName }).catch(() => null)
      if (supabaseProfile) setProfile(supabaseProfile)
    } finally {
      setFinishing(false)
    }
  }

  const STEP_TITLES = [
    'Quem é você?', 'Qual é seu foco?', 'Como você aparece?',
    'Como quer ser percebido(a)?', 'Seus pilares de conteúdo',
    'O que você oferece?', 'Seus limites', 'Sua identidade de fala',
  ]

  const steps = [
    // Step 0
    <div key={0} className="space-y-4">
      <div>
        <label className="label">Nome profissional</label>
        <input className="input" value={professionalName} onChange={e => setProfessionalName(e.target.value)} placeholder="Ex: Ana Lima, Dr. Carlos, @anaverde" />
      </div>
      <div>
        <label className="label">Área de atuação</label>
        <input className="input" value={specialty} onChange={e => setSpecialty(e.target.value)} placeholder="Ex: Nutricionista, Coach, Fotógrafa, Advogada..." />
      </div>
      <div>
        <label className="label">Cidade</label>
        <input className="input" value={city} onChange={e => setCity(e.target.value)} placeholder="Ex: São Paulo, SP" />
      </div>
      <div>
        <label className="label">Público principal</label>
        <input className="input" value={targetAudience} onChange={e => setTargetAudience(e.target.value)} placeholder="Ex: Mulheres 25-40, Empreendedores iniciantes..." />
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
            color: '#9B8CFF',
            boxShadow: '0 0 16px rgba(109,93,246,0.15)',
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

    // Step 2
    <div key={2} className="space-y-2">
      {EXPOSURE_OPTIONS.map(({ value, label, desc, emoji }) => (
        <button
          key={value}
          onClick={() => setExposureLevel(value)}
          className="w-full text-left px-4 py-3.5 rounded-2xl transition-all duration-200 flex items-center gap-3"
          style={exposureLevel === value ? {
            background: 'rgba(109,93,246,0.15)',
            border: '1px solid rgba(109,93,246,0.4)',
            boxShadow: '0 0 16px rgba(109,93,246,0.15)',
          } : {
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
          }}
        >
          <span className="text-xl">{emoji}</span>
          <div>
            <span className="block font-bold text-sm" style={{ color: exposureLevel === value ? '#9B8CFF' : 'var(--text-primary)' }}>{label}</span>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{desc}</span>
          </div>
        </button>
      ))}
    </div>,

    // Step 3
    <div key={3} className="space-y-4">
      <MultiChip options={TONE_OPTIONS} selected={voiceTone} onToggle={handleToneToggle} />
    </div>,

    // Step 4
    <div key={4} className="space-y-4">
      <MultiChip options={pillarsToShow} selected={selectedPillars} onToggle={handlePillarToggle} />
      <div>
        <label className="label">Pilar personalizado</label>
        <input className="input" placeholder="Digite e pressione Enter..."
          onKeyDown={e => { if (e.key === 'Enter' && e.currentTarget.value) { handlePillarToggle(e.currentTarget.value); e.currentTarget.value = '' } }} />
      </div>
    </div>,

    // Step 5
    <div key={5} className="space-y-4">
      <MultiChip
        options={SERVICE_SUGGESTIONS}
        selected={selectedServices}
        onToggle={handleServiceToggle}
      />
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
      </div>
      <div>
        <label className="label">Palavras que evita</label>
        <input className="input" value={avoidedWords} onChange={e => setAvoidedWords(e.target.value)} placeholder="Ex: palavras que não combinam com você (separadas por vírgula)" />
      </div>
      <div>
        <label className="label">Tipo de serviço principal</label>
        <input className="input" value={serviceType} onChange={e => setServiceType(e.target.value)} placeholder="Ex: Atendimento presencial e online" />
      </div>
    </div>,

    // Step 7
    <div key={7} className="space-y-4">
      <div>
        <label className="label">Bordão principal (opcional)</label>
        <input className="input" value={catchphrase} onChange={e => setCatchphrase(e.target.value)} placeholder='Ex: "Descomplica!", "Bora pra cima!", "Simples assim."' />
      </div>
      <div
        className="rounded-2xl p-4"
        style={{ background: 'rgba(83,214,161,0.08)', border: '1px solid rgba(83,214,161,0.2)' }}
      >
        <p className="text-sm font-semibold" style={{ color: '#53D6A1' }}>
          Tudo pronto! Com essas informações, cada ideia vai parecer sua — não de um robô genérico.
        </p>
      </div>
    </div>,
  ]

  return (
    <div className="h-full flex flex-col max-w-md mx-auto relative overflow-y-auto" style={{ background: '#0D0B14', minHeight: '100svh' }}>
      {/* Orbs */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute -top-20 right-0 w-[300px] h-[300px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(109,93,246,0.2) 0%, transparent 65%)', filter: 'blur(50px)' }} />
      </div>

      <div className="flex-1 p-6 overflow-y-auto relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 pt-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #6D5DF6, #9B8CFF)', boxShadow: '0 0 16px rgba(109,93,246,0.4)' }}>
              <Zap size={15} className="text-white" fill="white" />
            </div>
            <span className="font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>Destravaí</span>
          </div>
          <span className="text-xs font-bold tabular-nums" style={{ color: 'var(--text-muted)' }}>
            {step + 1} / {TOTAL_STEPS}
          </span>
        </div>

        <StepIndicator current={step} total={TOTAL_STEPS} />

        {/* Step */}
        <div className="mb-6 animate-fade-up">
          <h2 className="text-2xl font-extrabold tracking-tight mb-1" style={{ color: 'var(--text-primary)' }}>
            {STEP_TITLES[step]}
          </h2>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {step === 0 && 'Vamos entender seu jeito antes de sugerir qualquer ideia.'}
            {step === 1 && 'Isso guia o tipo de conteúdo que a IA vai sugerir.'}
            {step === 2 && 'Sem pressão. Pode evoluir quando quiser.'}
            {step === 3 && 'Escolha os atributos que combinam com você.'}
            {step === 4 && 'Os temas que sustentam sua presença.'}
            {step === 5 && 'Ajuda a criar CTAs naturais.'}
            {step === 6 && 'A IA vai respeitar isso sempre.'}
            {step === 7 && 'Dá personalidade às sugestões.'}
          </p>
        </div>

        <div className="animate-fade-up">{steps[step]}</div>
      </div>

      {/* Navigation */}
      <div className="p-6 flex gap-3 relative z-10"
        style={{ background: 'rgba(13,11,20,0.8)', borderTop: '1px solid rgba(255,255,255,0.06)', backdropFilter: 'blur(20px)' }}>
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
              : <><Check size={18} /> Começar</>
            }
          </button>
        )}
      </div>
    </div>
  )
}
