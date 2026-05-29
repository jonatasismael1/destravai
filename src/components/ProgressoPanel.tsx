import { useApp } from '../context/AppContext'
import { Flame, Check, TrendingUp, Award, Target, Zap } from 'lucide-react'

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

  const tips: string[] = []
  if (balance.sale < 2) tips.push('Você está evitando venda. Adicione uma venda leve esta semana.')
  if (balance.backstage < 2) tips.push('Que tal mostrar um bastidor hoje? Cria conexão.')
  if (balance.humor < 1) tips.push('Um toque de humor torna o perfil mais humano.')
  if (balance.authority < 3) tips.push('Reforce autoridade com uma sequência técnica.')

  return (
    <div className="space-y-5">
      {/* Level card */}
      <div
        className="relative rounded-3xl p-5 overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, rgba(109,93,246,0.2), rgba(155,140,255,0.1))',
          border: '1px solid rgba(109,93,246,0.3)',
          boxShadow: '0 0 40px rgba(109,93,246,0.1)',
        }}
      >
        <div className="absolute top-0 right-0 w-32 h-32 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(109,93,246,0.3), transparent)', filter: 'blur(30px)' }} />
        <div className="absolute top-0 left-0 right-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(109,93,246,0.7), transparent)' }} />

        <div className="flex items-center gap-3 mb-4 relative">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center animate-float"
            style={{ background: 'linear-gradient(135deg, #6D5DF6, #9B8CFF)', boxShadow: '0 0 24px rgba(109,93,246,0.5)' }}>
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

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2.5">
        {[
          { icon: <Check size={16} />, value: progress.missionsCompleted, label: 'Concluídas', color: '#53D6A1', bg: 'rgba(83,214,161,0.1)', border: 'rgba(83,214,161,0.2)' },
          { icon: <Flame size={16} />, value: progress.currentStreak, label: 'Dias seguidos', color: '#FF7A6B', bg: 'rgba(255,122,107,0.1)', border: 'rgba(255,122,107,0.2)' },
          { icon: <TrendingUp size={16} />, value: progress.weeklyMissions, label: 'Esta semana', color: '#9B8CFF', bg: 'rgba(109,93,246,0.1)', border: 'rgba(109,93,246,0.2)' },
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
                  background: 'linear-gradient(135deg, #6D5DF6, #9B8CFF)',
                  boxShadow: '0 0 16px rgba(109,93,246,0.5)',
                } : {
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
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
        <div className="rounded-3xl p-8 flex flex-col items-center text-center gap-4"
          style={{ background: 'rgba(109,93,246,0.06)', border: '1px solid rgba(109,93,246,0.15)' }}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center animate-float"
            style={{ background: 'linear-gradient(135deg, rgba(109,93,246,0.3), rgba(155,140,255,0.2))', border: '1px solid rgba(109,93,246,0.3)' }}>
            <Zap size={24} style={{ color: '#9B8CFF' }} fill="#9B8CFF" />
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
