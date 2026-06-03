import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { Flame, Check, TrendingUp, Award, Target, Zap, Lock, Users, ChevronRight, Shield, Star, X } from 'lucide-react'
import { ACHIEVEMENTS } from '../lib/achievements'
import { MAX_STREAK_SHIELDS } from '../lib/progress'
import { loadAchievements, checkAndUnlockAchievements, type UnlockedAchievement } from '../services/achievementsService'
import { loadConsistencyData, type ConsistencyData } from '../services/eventsService'

const STREAK7_KEY = 'destravai-streak7-celebrated'

function Day7Popup({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-5"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(16px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-sm rounded-3xl p-7 text-center relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, rgba(109,93,246,0.3), rgba(247,185,85,0.2))',
          border: '1px solid rgba(247,185,85,0.5)',
          boxShadow: '0 0 60px rgba(247,185,85,0.3)',
        }}
      >
        <div className="absolute top-0 left-0 right-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(247,185,85,0.8), transparent)' }} />
        <button
          onClick={onClose}
          className="absolute top-4 right-4 opacity-50 hover:opacity-100 transition-opacity"
          style={{ color: 'var(--text-muted)' }}
          aria-label="Fechar"
        >
          <X size={18} />
        </button>

        <div
          className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-5 animate-float"
          style={{
            background: 'linear-gradient(135deg, #F7B955, #FF7A6B)',
            boxShadow: '0 0 40px rgba(247,185,85,0.6)',
          }}
        >
          <Star size={36} className="text-white" fill="white" />
        </div>

        <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: '#F7B955' }}>
          7 dias de constância
        </p>
        <h2 className="font-extrabold text-2xl mb-3" style={{ color: 'var(--text-primary)' }}>
          Você chegou ao Dia 7!
        </h2>
        <p className="text-sm leading-relaxed mb-6" style={{ color: 'var(--text-secondary)' }}>
          Você produziu conteúdo por 7 dias. Isso é o que separa quem fala em fazer de quem realmente faz. Continue — a constância é a sua maior vantagem.
        </p>

        <button
          onClick={onClose}
          className="btn-primary w-full py-3.5 text-sm"
          style={{ background: 'linear-gradient(135deg, #F7B955, #FF7A6B)', boxShadow: '0 4px 24px rgba(247,185,85,0.4)' }}
        >
          Continuar produzindo
        </button>
      </div>
    </div>
  )
}

// Painel de progresso reutilizável (sem cabeçalho de página). Usado dentro de
// "Meu Espaço" para deixar o progresso visível e motivar o usuário.

const CONTENT_LABELS: Record<string, string> = {
  authority: 'Autoridade', backstage: 'Bastidor', connection: 'Conexão',
  sale: 'Venda', interaction: 'Interação', humor: 'Humor',
}

const CONTENT_COLORS: Record<string, string> = {
  authority: 'linear-gradient(90deg, #6D5DF6, #9B8CFF)',
  backstage: 'linear-gradient(90deg, #F7B955, #FF7A6B)',
  connection: 'linear-gradient(90deg, #53D6A1, #3BB88A)',
  sale: 'linear-gradient(90deg, #FF7A6B, #F7B955)',
  interaction: 'linear-gradient(90deg, #9B8CFF, #6D5DF6)',
  humor: 'linear-gradient(90deg, #53D6A1, #9B8CFF)',
}

const LEVELS = [
  { name: 'Começando a aparecer', min: 0, max: 5 },
  { name: 'Criando ritmo', min: 5, max: 15 },
  { name: 'Presença consistente', min: 15, max: 30 },
  { name: 'Perfil ativo', min: 30, max: 50 },
  { name: 'Referência em movimento', min: 50, max: 999 },
]

function getLevelProgress(completed: number) {
  const level = LEVELS.find(l => completed >= l.min && completed < l.max) ?? LEVELS[0]
  const nextLevel = LEVELS[LEVELS.indexOf(level) + 1]
  const pct = nextLevel ? ((completed - level.min) / (level.max - level.min)) * 100 : 100
  return { level, nextLevel, progress: Math.min(100, pct) }
}

export default function ProgressoPanel() {
  const { state } = useApp()
  const { progress, missions } = state
  const navigate = useNavigate()

  // Conquistas: carrega as já desbloqueadas e verifica se há novas a desbloquear.
  // Tolerante a falhas — se o backend de conquistas não responder, a tela continua igual.
  const [unlocked, setUnlocked] = useState<UnlockedAchievement[]>([])
  const [justUnlocked, setJustUnlocked] = useState<UnlockedAchievement[]>([])

  // Constância: dados dos primeiros 7 dias de produção de conteúdo real.
  const [consistency, setConsistency] = useState<ConsistencyData | null>(null)
  const [showDay7Popup, setShowDay7Popup] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const existing = await loadAchievements()
      if (!cancelled) setUnlocked(existing)
      const fresh = await checkAndUnlockAchievements(progress)
      if (!cancelled && fresh.length > 0) {
        setJustUnlocked(fresh)
        setUnlocked(prev => {
          const have = new Set(prev.map(a => a.key))
          return [...fresh.filter(f => !have.has(f.key)), ...prev]
        })
      }
    })()
    return () => { cancelled = true }
    // Reavalia quando o nº de missões concluídas muda (proxy de progresso).
  }, [progress.missionsCompleted, progress.currentStreak]) // eslint-disable-line react-hooks/exhaustive-deps

  // Carrega dados de constância (dias únicos de produção de conteúdo real).
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const data = await loadConsistencyData()
      if (cancelled) return
      setConsistency(data)
      // Mostra popup ao completar 7 dias pela primeira vez.
      if (data && data.daysCompleted >= 7) {
        const alreadyCelebrated = localStorage.getItem(STREAK7_KEY) === 'true'
        if (!alreadyCelebrated) {
          setShowDay7Popup(true)
        }
      }
    })()
    return () => { cancelled = true }
  }, [progress.missionsCompleted]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleDay7PopupClose = () => {
    localStorage.setItem(STREAK7_KEY, 'true')
    setShowDay7Popup(false)
  }

  const unlockedKeys = new Set(unlocked.map(a => a.key))

  const doneMissions = missions.filter(m => m.status === 'done')
  const { level, nextLevel, progress: levelProgress } = getLevelProgress(progress.missionsCompleted)

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = new Date()
    date.setDate(date.getDate() - (6 - i))
    const dateStr = date.toDateString()
    const hasActivity = missions.some(m => m.status === 'done' && new Date(m.date).toDateString() === dateStr)
    return { date, hasActivity }
  })

  const balance = progress.contentBalance

  // Score de constância (0–100): combina streak, missões da semana, total e
  // diversidade dos tipos de conteúdo. Motiva sem ser punitivo.
  const balanceUsed = Object.values(balance).filter(v => v > 0).length
  const constancyScore = Math.min(100, Math.round(
    progress.currentStreak * 8 +
    progress.weeklyMissions * 6 +
    Math.min(progress.missionsCompleted, 20) * 2 +
    balanceUsed * 3,
  ))
  const scoreLabel = constancyScore >= 85 ? 'Referência em movimento'
    : constancyScore >= 60 ? 'Presença constante'
    : constancyScore >= 30 ? 'Pegando o ritmo'
    : 'Começando a aparecer'

  const tips: string[] = []
  if (balance.sale < 2) tips.push('Você está evitando venda. Adicione uma venda leve esta semana.')
  if (balance.backstage < 2) tips.push('Que tal mostrar um bastidor hoje? Cria conexão.')
  if (balance.humor < 1) tips.push('Um toque de humor torna o perfil mais humano.')
  if (balance.authority < 3) tips.push('Reforce autoridade com uma sequência técnica.')

  // ── Jornada de constância contínua ───────────────────────────────────────
  // A primeira semana (Dia 1→7) forma o hábito. DEPOIS dela, a jornada NÃO pode
  // estagnar em "7/7" — ela vira uma escada de marcos (selos) que sempre tem um
  // próximo objetivo, e o total de dias de conteúdo nunca para de crescer.
  const CONSISTENCY_MILESTONES = [7, 14, 30, 60, 90, 180, 365]
  const totalDays = consistency?.totalContentDays ?? 0          // dias de conteúdo (vida toda)
  const firstWeekDays = Math.min(consistency?.daysCompleted ?? 0, 7)
  const firstWeekDone = totalDays >= 7
  const nextMilestone = CONSISTENCY_MILESTONES.find(m => m > totalDays) ?? null
  const prevMilestone = [...CONSISTENCY_MILESTONES].reverse().find(m => m <= totalDays) ?? 0
  const milestoneProgress = nextMilestone
    ? Math.round(((totalDays - prevMilestone) / (nextMilestone - prevMilestone)) * 100)
    : 100

  return (
    <div className="space-y-5">
      {/* Popup do Dia 7 */}
      {showDay7Popup && <Day7Popup onClose={handleDay7PopupClose} />}

      {/* Level card — hero da tela, com acento de marca tonal */}
      <div className="relative rounded-2xl p-5 overflow-hidden"
        style={{ background: 'var(--brand-soft)', border: '1px solid var(--brand-border)' }}>
        <div className="flex items-center gap-3 mb-4 relative">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{ background: 'var(--brand)' }}>
            <Award size={22} className="text-white" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: 'var(--text-muted)' }}>Nível atual</p>
            <p className="font-extrabold text-lg leading-tight" style={{ color: 'var(--text-primary)' }}>{level.name}</p>
          </div>
        </div>

        <div className="progress-bar mb-2">
          <div className="progress-fill" style={{ width: `${levelProgress}%` }} />
        </div>
        {nextLevel && (
          <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
            <span style={{ color: '#9B8CFF' }}>{level.max - progress.missionsCompleted} missões</span> para{' '}
            <span style={{ color: 'var(--text-primary)' }}>{nextLevel.name}</span>
          </p>
        )}
      </div>

      {/* Score de constância */}
      <div className="rounded-3xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
        <div className="flex items-end justify-between mb-2">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: 'var(--text-muted)' }}>Score de constância</p>
            <p className="font-extrabold text-sm" style={{ color: '#9B8CFF' }}>{scoreLabel}</p>
          </div>
          <p className="font-extrabold text-3xl leading-none" style={{ color: 'var(--text-primary)' }}>
            {constancyScore}<span className="text-sm" style={{ color: 'var(--text-muted)' }}>/100</span>
          </p>
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${constancyScore}%` }} />
        </div>

        {/* Escudos de sequência: protegem o streak de zerar ao pular 1 dia */}
        <div className="flex items-center justify-between mt-4 pt-4" style={{ borderTop: '1px solid var(--border-color)' }}>
          <div className="flex items-center gap-2">
            <Shield size={15} style={{ color: '#9B8CFF' }} />
            <div>
              <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>Escudos de sequência</p>
              <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Cobrem 1 dia perdido · ganha 1 a cada 7 dias</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {Array.from({ length: MAX_STREAK_SHIELDS }).map((_, i) => {
              const active = i < (progress.streakShields ?? 0)
              return (
                <Shield key={i} size={18}
                  style={{ color: active ? '#9B8CFF' : 'var(--text-muted)', fill: active ? '#9B8CFF' : 'transparent', opacity: active ? 1 : 0.35 }} />
              )
            })}
          </div>
        </div>
      </div>

      {/* Jornada de constância: 1ª semana (Dia 1→7) e, depois dela, marcos
          crescentes (selos) — assim nunca estagna e sempre há um próximo objetivo. */}
      <div className="rounded-3xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
        {!firstWeekDone ? (
          /* ─── Primeira semana: forma o hábito (Dia 1 a 7) ─── */
          <>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: 'var(--text-muted)' }}>
                  Jornada de constância
                </p>
                <p className="font-extrabold text-sm" style={{ color: 'var(--text-primary)' }}>
                  {consistency ? `Dia ${firstWeekDays} de 7` : 'Começando...'}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <Flame size={16} style={{ color: '#FF7A6B' }} />
                <span className="font-extrabold text-lg" style={{ color: 'var(--text-primary)' }}>
                  {firstWeekDays}
                  <span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>/7</span>
                </span>
              </div>
            </div>

            {/* 7 bolhas de dia */}
            <div className="flex justify-between gap-1.5">
              {Array.from({ length: 7 }).map((_, i) => {
                const done = i < firstWeekDays
                const isCurrent = i === firstWeekDays && i < 7
                return (
                  <div key={i} className="flex flex-col items-center gap-1.5 flex-1">
                    <div
                      className="w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-300"
                      style={
                        done
                          ? { background: 'linear-gradient(135deg, #F7B955, #FF7A6B)', boxShadow: '0 0 16px rgba(247,185,85,0.5)' }
                          : isCurrent
                          ? { background: 'rgba(247,185,85,0.12)', border: '2px dashed rgba(247,185,85,0.5)' }
                          : { background: 'var(--bg-card)', border: '1px solid var(--border-color)', opacity: 0.5 }
                      }
                    >
                      {done ? <Check size={14} className="text-white" />
                        : isCurrent ? <Flame size={13} style={{ color: '#F7B955' }} />
                        : <span className="text-[9px] font-bold" style={{ color: 'var(--text-muted)' }}>{i + 1}</span>}
                    </div>
                    <span className="text-[9px] font-bold uppercase" style={{ color: done ? '#F7B955' : 'var(--text-muted)' }}>
                      Dia {i + 1}
                    </span>
                  </div>
                )
              })}
            </div>

            <p className="text-xs text-center mt-3 font-medium" style={{ color: 'var(--text-muted)' }}>
              {firstWeekDays === 0
                ? 'Marque sua primeira missão como feita para começar a jornada.'
                : `Faltam ${7 - firstWeekDays} ${7 - firstWeekDays === 1 ? 'dia' : 'dias'} para completar sua primeira semana.`}
            </p>
          </>
        ) : (
          /* ─── Depois da 1ª semana: escada de marcos (sempre há um próximo) ─── */
          <>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: 'var(--text-muted)' }}>
                  Jornada de constância
                </p>
                <p className="font-extrabold text-sm" style={{ color: 'var(--text-primary)' }}>
                  {totalDays} {totalDays === 1 ? 'dia' : 'dias'} de conteúdo
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <Flame size={16} style={{ color: '#FF7A6B' }} />
                <span className="font-extrabold text-lg tabular-nums" style={{ color: 'var(--text-primary)' }}>
                  {totalDays}
                </span>
              </div>
            </div>

            {/* Barra rumo ao próximo selo */}
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}>
                {nextMilestone ? `Próximo selo: ${nextMilestone} dias` : 'Todos os selos conquistados'}
              </p>
              <p className="text-[10px] font-bold tabular-nums" style={{ color: '#F7B955' }}>
                {milestoneProgress}%
              </p>
            </div>
            <div className="progress-bar">
              <div className="h-full rounded-full transition-all duration-700"
                style={{ width: `${milestoneProgress}%`, background: 'linear-gradient(90deg, #F7B955, #FF7A6B)' }} />
            </div>

            {/* Selos: conquistados, próximo (em destaque) e os bloqueados */}
            <div className="flex justify-between gap-1.5 mt-4">
              {CONSISTENCY_MILESTONES.map(m => {
                const conquered = totalDays >= m
                const isNext = m === nextMilestone
                return (
                  <div key={m} className="flex flex-col items-center gap-1.5 flex-1">
                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-300"
                      style={
                        conquered
                          ? { background: 'linear-gradient(135deg, #F7B955, #FF7A6B)', boxShadow: '0 0 16px rgba(247,185,85,0.5)' }
                          : isNext
                          ? { background: 'rgba(247,185,85,0.12)', border: '2px dashed rgba(247,185,85,0.5)' }
                          : { background: 'var(--bg-card)', border: '1px solid var(--border-color)', opacity: 0.5 }
                      }>
                      {conquered ? <Check size={14} className="text-white" />
                        : isNext ? <Flame size={13} style={{ color: '#F7B955' }} />
                        : <Lock size={12} style={{ color: 'var(--text-muted)' }} />}
                    </div>
                    <span className="text-[9px] font-bold uppercase" style={{ color: conquered ? '#F7B955' : 'var(--text-muted)' }}>
                      {m}d
                    </span>
                  </div>
                )
              })}
            </div>

            <p className="text-xs text-center mt-3 font-bold" style={{ color: '#F7B955' }}>
              {nextMilestone
                ? `Faltam ${nextMilestone - totalDays} ${nextMilestone - totalDays === 1 ? 'dia' : 'dias'} para o selo de ${nextMilestone} dias.`
                : 'Você passou de 365 dias de conteúdo. Lenda da constância. 🏆'}
            </p>
          </>
        )}
      </div>

      {/* Banner de conquista recém-desbloqueada */}
      {justUnlocked.length > 0 && (
        <div className="rounded-3xl p-5 animate-fade-up"
          style={{ background: 'linear-gradient(135deg, rgba(247,185,85,0.15), rgba(255,122,107,0.08))', border: '1px solid rgba(247,185,85,0.35)', boxShadow: '0 0 30px rgba(247,185,85,0.12)' }}>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: '#F7B955' }}>Nova conquista desbloqueada!</p>
          <div className="space-y-2">
            {justUnlocked.map(a => (
              <div key={a.key} className="flex items-center gap-3">
                <span style={{ fontSize: 26 }}>{a.emoji}</span>
                <div>
                  <p className="font-extrabold text-sm" style={{ color: 'var(--text-primary)' }}>{a.title}</p>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{a.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grupos & Ranking — leva para a competição de constância entre amigos */}
      <button onClick={() => navigate('/grupos')}
        className="w-full flex items-center rounded-2xl p-5 gap-4 text-left active:scale-[0.98]"
        style={{ background: 'var(--brand-soft)', border: '1px solid var(--brand-border)' }}>
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'var(--brand)' }}>
          <Users size={22} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-extrabold text-base" style={{ color: 'var(--text-primary)' }}>Grupos &amp; Ranking</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>Dispute constância com amigos e mantenha o ritmo juntos.</p>
        </div>
        <ChevronRight size={18} style={{ color: 'var(--text-muted)' }} />
      </button>

      {/* Conquistas (badges) */}
      <div className="glass p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-extrabold" style={{ color: 'var(--text-primary)' }}>Conquistas</h3>
          <span className="text-xs font-bold" style={{ color: '#9B8CFF' }}>
            {unlockedKeys.size}/{ACHIEVEMENTS.length}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          {ACHIEVEMENTS.map(a => {
            const isOn = unlockedKeys.has(a.key)
            return (
              <div key={a.key} className="rounded-2xl p-3 text-center transition-all duration-300"
                style={isOn ? {
                  background: 'var(--brand-soft)',
                  border: '1px solid var(--brand-border)',
                } : {
                  background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', opacity: 0.55,
                }}
                title={a.description}>
                <div style={{ fontSize: 24, filter: isOn ? 'none' : 'grayscale(1)' }} className="mb-1 flex items-center justify-center" >
                  {isOn ? a.emoji : <Lock size={18} style={{ color: 'var(--text-muted)' }} />}
                </div>
                <p className="text-[10px] font-bold leading-tight" style={{ color: isOn ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                  {a.title}
                </p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2.5">
        {[
          // Rótulos nomeiam a unidade para não confundir o número (ex.: "2 missões
          // na semana", não "2 semanas"). Mesmo padrão de clareza da Home.
          { icon: <Check size={16} />, value: progress.missionsCompleted, label: 'Missões no total', color: '#53D6A1', bg: 'rgba(83,214,161,0.1)', border: 'rgba(83,214,161,0.2)' },
          { icon: <Flame size={16} />, value: progress.currentStreak, label: 'Dias seguidos', color: '#FF7A6B', bg: 'rgba(255,122,107,0.1)', border: 'rgba(255,122,107,0.2)' },
          { icon: <TrendingUp size={16} />, value: progress.weeklyMissions, label: 'Missões na semana', color: '#9B8CFF', bg: 'rgba(109,93,246,0.1)', border: 'rgba(109,93,246,0.2)' },
        ].map(({ icon, value, label, color, bg, border }) => (
          <div key={label} className="rounded-2xl p-4 text-center" style={{ background: bg, border: `1px solid ${border}` }}>
            <div className="flex justify-center mb-2" style={{ color }}>{icon}</div>
            <p className="text-2xl font-extrabold" style={{ color: 'var(--text-primary)' }}>{value}</p>
            <p className="text-[9px] font-bold uppercase tracking-wide mt-0.5" style={{ color: 'var(--text-muted)' }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Week activity */}
      <div className="glass p-5">
        <h3 className="font-extrabold mb-4" style={{ color: 'var(--text-primary)' }}>Atividade desta semana</h3>
        <div className="flex justify-between gap-1">
          {weekDays.map(({ date, hasActivity }) => (
            <div key={date.toISOString()} className="flex flex-col items-center gap-2 flex-1">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300"
                style={hasActivity ? {
                  background: 'var(--brand)',
                } : {
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                {hasActivity
                  ? <Check size={14} className="text-white" />
                  : <div className="w-1 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.2)' }} />
                }
              </div>
              <span className="text-[9px] font-bold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                {date.toLocaleDateString('pt-BR', { weekday: 'narrow' })}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Content balance */}
      <div className="glass p-5">
        <h3 className="font-extrabold mb-1" style={{ color: 'var(--text-primary)' }}>Equilíbrio de conteúdo</h3>
        <p className="text-xs font-medium mb-5" style={{ color: 'var(--text-muted)' }}>Tipos que você executou</p>
        <div className="space-y-4">
          {Object.entries(balance).map(([cat, val]) => (
            <div key={cat} className="flex items-center gap-3">
              <span className="text-xs font-bold w-20 flex-shrink-0" style={{ color: 'var(--text-secondary)' }}>
                {CONTENT_LABELS[cat]}
              </span>
              <div className="flex-1 progress-bar">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${Math.min(100, (val / 10) * 100)}%`,
                    background: CONTENT_COLORS[cat] ?? 'linear-gradient(90deg, #6D5DF6, #9B8CFF)',
                    boxShadow: val > 0 ? '0 0 8px rgba(109,93,246,0.4)' : 'none',
                  }}
                />
              </div>
              <span className="text-xs font-bold tabular-nums w-4" style={{ color: 'var(--text-muted)' }}>{val}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tips */}
      {tips.length > 0 && (
        <div
          className="rounded-3xl p-5"
          style={{ background: 'rgba(247,185,85,0.08)', border: '1px solid rgba(247,185,85,0.2)' }}
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(247,185,85,0.15)', border: '1px solid rgba(247,185,85,0.3)' }}>
              <Target size={14} style={{ color: '#F7B955' }} />
            </div>
            <h3 className="font-extrabold" style={{ color: 'var(--text-primary)' }}>Sugestões da semana</h3>
          </div>
          <div className="space-y-2.5">
            {tips.map((tip, i) => (
              <p key={i} className="text-sm flex gap-2" style={{ color: 'var(--text-secondary)' }}>
                <span style={{ color: '#F7B955' }}>→</span> {tip}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Missions history */}
      {doneMissions.length > 0 && (
        <div>
          <h3 className="font-extrabold mb-3" style={{ color: 'var(--text-primary)' }}>Missões concluídas</h3>
          <div className="space-y-2">
            {doneMissions.slice(0, 10).map(m => (
              <div key={m.id} className="glass-sm flex items-center gap-3 p-4">
                <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(83,214,161,0.15)', border: '1px solid rgba(83,214,161,0.3)' }}>
                  <Check size={13} style={{ color: '#53D6A1' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>{m.title}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {new Date(m.date).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}
                  </p>
                </div>
                <span className="tag tag-mint text-[10px]">+{m.points}pts</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {progress.missionsCompleted === 0 && (
        <div className="app-card rounded-2xl p-8 flex flex-col items-center text-center gap-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: 'var(--brand-soft)', border: '1px solid var(--brand-border)' }}>
            <Zap size={24} style={{ color: 'var(--brand)' }} />
          </div>
          <div>
            <p className="font-extrabold text-lg" style={{ color: 'var(--text-primary)' }}>Comece sua jornada</p>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Conclua missões para ver seu progresso aqui.</p>
          </div>
        </div>
      )}
    </div>
  )
}
